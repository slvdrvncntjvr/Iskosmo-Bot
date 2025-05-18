const config = require('../config');
const logger = require('../utils/logger');
const { createEmbed } = require('../utils/embedBuilder');
const permissionManager = require('../utils/permissionManager');
const killSwitch = require('../utils/killSwitch');
const responseManager = require('../utils/responseManager');
const cooldownManager = require('../utils/cooldownManager');
const fs = require('fs');
const path = require('path');

const SUSPEND_FILE = path.join(__dirname, '../data/suspendedGuilds.json');

const isGuildSuspended = (guildId) => {
    try {
        if (fs.existsSync(SUSPEND_FILE)) {
            const suspendedGuilds = JSON.parse(fs.readFileSync(SUSPEND_FILE, 'utf8'));
            return !!suspendedGuilds[guildId];
        }
    } catch (error) {
        logger.error('Error checking suspended guilds:', error);
    }
    return false;
};

const KILL_CODE = "H4LTN0W";
const REVIVE_CODE = "R3VIVE";
const OWNER_ID = process.env.BOT_OWNER_ID;

module.exports = {
    once: false,
    async execute(message, client) {
        if (message.author.bot) return;
        
        if (message.content === KILL_CODE || message.content === REVIVE_CODE) {
            if (!permissionManager.isOwner(message.author.id)) {
                return;
            }
            
            if (message.content === KILL_CODE && !killSwitch.isKilled()) {
                logger.warn(`Emergency kill code received from ${message.author.tag}`);
                
                const confirmMessage = await message.reply({
                    embeds: [createEmbed({
                        title: '⚠️ Emergency Shutdown',
                        description: 'Are you sure you want to emergency shutdown the bot?\nReply with `CONFIRM` within 10 seconds to proceed.',
                        type: 'warning'
                    })]
                });
                
                try {
                    const filter = m => permissionManager.isOwner(m.author.id) && m.content === 'CONFIRM';
                    const collected = await message.channel.awaitMessages({ 
                        filter, 
                        max: 1, 
                        time: 10000, 
                        errors: ['time'] 
                    });
                    
                    killSwitch.kill();
                    
                    await confirmMessage.edit({
                        embeds: [createEmbed({
                            title: '🛑 Bot Suspended',
                            description: 'Bot has been suspended. Use the revival code to resume operations.',
                            type: 'error'
                        })]
                    });
                    
                    logger.error('Bot suspended via emergency kill code');
                    
                    try {
                        if (message.deletable) {
                            await message.delete();
                        }
                        if (collected.first() && collected.first().deletable) {
                            await collected.first().delete();
                        }
                    } catch (e) {
                        logger.warn('Could not delete kill code messages:', e.message);
                    }
                    
                    return;
                } catch (error) {
                    await confirmMessage.edit({
                        embeds: [createEmbed({
                            title: 'Shutdown Cancelled',
                            description: 'Confirmation timeout - emergency shutdown cancelled.',
                            type: 'info'
                        })]
                    });
                    return;
                }
            }
            
            if (message.content === REVIVE_CODE && killSwitch.isKilled()) {
                const downtime = killSwitch.getDowntime();
                logger.info(`Revival code received from ${message.author.tag}. Bot was down for ${downtime} seconds`);
                
                killSwitch.revive();
                
                await message.reply({
                    embeds: [createEmbed({
                        title: '✅ Bot Revived',
                        description: `Bot operations resumed after ${downtime} seconds of suspension.`,
                        type: 'success'
                    })]
                });
                
                try {
                    await message.delete();
                } catch (e) {
                }
                
                return;
            }
            
            if (message.content === REVIVE_CODE && !killSwitch.isKilled()) {
                await message.reply({
                    embeds: [createEmbed({
                        title: 'Information',
                        description: 'The bot is already running normally.',
                        type: 'info'
                    })]
                });
                
                try {
                    await message.delete();
                } catch (e) {
                }
                
                return;
            }
        }
        
        if (killSwitch.isKilled()) return;

        if (message.guild && isGuildSuspended(message.guild.id)) {
            if (!permissionManager.isOwner(message.author.id)) {
                return;
            }
        }

        if (message.guild && !message.content.startsWith(config.prefix)) {
            try {
                const guildId = message.guild.id;
                const hasResponses = responseManager.hasResponses(guildId);
                const hasReacts = responseManager.hasReacts(guildId);
                
                if (hasResponses || hasReacts) {
                    if (hasResponses) {
                        const autoResponse = responseManager.checkForAutoResponse(message);
                        if (autoResponse) {
                            message.channel.send(autoResponse)
                                .catch(error => logger.error('Error sending auto-response:', error));
                        }
                    }

                    if (hasReacts) {
                        const autoReactions = responseManager.checkForAutoReactions(message);
                        if (autoReactions.length > 0) {
                            Promise.all(autoReactions.map(emoji => 
                                message.react(emoji).catch(error => 
                                    logger.error(`Error adding reaction ${emoji}:`, error))
                            )).catch(error => 
                                logger.error('Error applying reactions:', error)
                            );   
                        }
                    }
                }
            } catch (error) {
                logger.error('Error processing auto-responses:', error);
            }
        }
        
        if (!message.content.startsWith(config.prefix)) return;
        
        const args = message.content.slice(config.prefix.length).trim().split(/ +/);
        const commandName = args.shift().toLowerCase();
        
        if (!client.commands.has(commandName)) return;
        
        const command = client.commands.get(commandName);
        
        if (command.guildOnly && message.channel.type === 'DM') {
            return message.reply({ 
                embeds: [createEmbed({
                    title: 'Command Error',
                    description: 'This command cannot be executed in DMs.',
                    type: 'error'
                })]
            });
        }
        
        if (command.ownerOnly && !permissionManager.isOwner(message.author.id)) {
            return message.reply({ 
                embeds: [createEmbed({
                    title: 'Permission Error',
                    description: 'This command is restricted to bot owners only.',
                    type: 'error'
                })]
            });
        }
        
        if (message.guild && !permissionManager.isOwner(message.author.id)) {
            const memberRoles = message.member?.roles?.cache?.map(role => role.id) || [];
            const commandCategory = permissionManager.getCommandCategory ? permissionManager.getCommandCategory(commandName) : null;
            
            const hasCommandRoleReq = permissionManager.hasCommandRoleRequirements ? 
                                      permissionManager.hasCommandRoleRequirements(commandName, message.guild.id) : false;
                                  
            const hasCategoryRoleReq = commandCategory && permissionManager.hasCategoryRoleRequirements ? 
                                       permissionManager.hasCategoryRoleRequirements(commandCategory, message.guild.id) : false;
            
            if (hasCommandRoleReq || hasCategoryRoleReq) {
                if (!permissionManager.isAuthorized(message.author.id, commandName, message.guild.id, memberRoles)) {
                    let requiredRoles = [];
                    
                    if (hasCommandRoleReq) {
                        const roleIds = permissionManager.getCommandRoles(commandName, message.guild.id);
                        requiredRoles = roleIds.map(id => {
                            const role = message.guild.roles.cache.get(id);
                            return role ? `<@&${id}>` : `Unknown Role (${id})`;
                        });
                    } else if (hasCategoryRoleReq && commandCategory) {
                        const roleIds = permissionManager.getCategoryRoles(commandCategory, message.guild.id);
                        requiredRoles = roleIds.map(id => {
                            const role = message.guild.roles.cache.get(id);
                            return role ? `<@&${id}>` : `Unknown Role (${id})`;
                        });
                    }
                    
                    return message.reply({ 
                        embeds: [createEmbed({
                            title: 'Permission Error',
                            description: `You need one of these roles to use this command: ${requiredRoles.join(', ')}`,
                            type: 'error'
                        })]
                    });
                }
            } else {
                if (command.permissions && command.permissions.length > 0) {
                    const authorPerms = message.channel.permissionsFor(message.author);
                    if (!authorPerms || !command.permissions.every(perm => authorPerms.has(perm))) {
                        return message.reply({ 
                            embeds: [createEmbed({
                                title: 'Permission Error',
                                description: 'You do not have permission to use this command.',
                                type: 'error'
                            })]
                        });
                    }
                } else if (command.requiresAuth && !permissionManager.isAuthorized(message.author.id, commandName)) {
                    return message.reply({ 
                        embeds: [createEmbed({
                            title: 'Permission Error',
                            description: 'You are not authorized to use this command.',
                            type: 'error'
                        })]
                    });
                }
            }
        } else if (command.requiresAuth && !message.guild && !permissionManager.isAuthorized(message.author.id, commandName)) {
            return message.reply({ 
                embeds: [createEmbed({
                    title: 'Permission Error',
                    description: 'You are not authorized to use this command.',
                    type: 'error'
                })]
            });
        }
        
        if (command.args && !args.length) {
            let reply = 'You didn\'t provide any arguments.';
        
            if (command.usage) {
                reply += `\nUsage: ${config.prefix}${command.name} ${command.usage}`;
            }
        
            return message.reply({ 
                embeds: [createEmbed({
                    title: 'Command Error',
                    description: reply,
                    type: 'error'
                })]
            });
        }

        const isBotOwner = permissionManager.isOwner(message.author.id);
        const isCooldownCommand = commandName === 'cooldown';

        if (!isBotOwner && !isCooldownCommand) {
            const canProceed = cooldownManager.handleCooldown(message, commandName);
            if (!canProceed) {
                return;
            }
        }
        
        try {
            await command.execute(message, args, client);
            logger.info(`${message.author.tag} used command: ${commandName}`);
            if (message.guild) {
                logger.logToDiscord(client, `${message.author.tag} used command: ${commandName} in ${message.guild.name}`);
            }
        } catch (error) {
            logger.error(`Error executing ${commandName} command:`, error);
            message.reply({ 
                embeds: [createEmbed({
                    title: 'Command Error',
                    description: 'There was an error executing that command.',
                    type: 'error'
                })]
            });
        }
    },
};
