const logger = require('../utils/logger');
const { createEmbed } = require('../utils/embedBuilder');
const permissionManager = require('../utils/permissionManager');
const killSwitch = require('../utils/killSwitch');
const cooldownManager = require('../utils/cooldownManager');
const fs = require('fs');
const path = require('path');

// Path to suspended guilds file
const SUSPEND_FILE = path.join(__dirname, '../data/suspendedGuilds.json');

// Helper function to check if guild is suspended
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

module.exports = {
    once: false,
    async execute(interaction, client) {
        // Global kill switch check
        if (killSwitch.isKilled()) {
            if (interaction.isCommand() && 
                interaction.commandName === 'revive' && 
                permissionManager.isOwner(interaction.user.id)) {
                const downtime = killSwitch.getDowntime();
                killSwitch.revive();
                await interaction.reply({
                    embeds: [createEmbed({
                        title: '✅ Bot Revived',
                        description: `Bot operations resumed after ${downtime} seconds of suspension.`,
                        type: 'success'
                    })],
                    ephemeral: true
                });
            } else {
                return;
            }
        }

        // Check for guild-specific suspension
        if (interaction.guildId && isGuildSuspended(interaction.guildId)) {
            // Only allow owners to use commands in suspended guilds
            if (!permissionManager.isOwner(interaction.user.id)) {
                return;
            }
        }

        // Only process slash commands
        if (!interaction.isCommand()) return;

        const commandName = interaction.commandName;
        const isBotOwner = permissionManager.isOwner(interaction.user.id);
        const isCooldownCommand = commandName === 'cooldown';
        
        // Cooldown handling
        if (!isBotOwner && !isCooldownCommand) {
            const canProceed = cooldownManager.handleInteractionCooldown(interaction, commandName);
            if (!canProceed) {
                return;
            }
        }

        const command = client.slashCommands.get(commandName);
        if (!command) return;

        // Permission checks
        if (command.ownerOnly && !isBotOwner) {
            return interaction.reply({ 
                embeds: [createEmbed({
                    title: 'Permission Error',
                    description: 'This command is restricted to bot owners only.',
                    type: 'error'
                })],
                ephemeral: true
            });
        }
        
        // Enhanced permission check including roles
        if (interaction.guildId && !isBotOwner) {
            // Get user's roles if in a guild
            const memberRoles = interaction.member?.roles?.cache?.map(role => role.id) || [];
            const commandCategory = permissionManager.getCommandCategory ? permissionManager.getCommandCategory(commandName) : null;
            
            // Check if command has specific role requirements
            const hasCommandRoleReq = permissionManager.hasCommandRoleRequirements ? 
                                     permissionManager.hasCommandRoleRequirements(commandName, interaction.guildId) : false;
                                  
            const hasCategoryRoleReq = commandCategory && permissionManager.hasCategoryRoleRequirements ? 
                                      permissionManager.hasCategoryRoleRequirements(commandCategory, interaction.guildId) : false;
            
            // If command has role requirements, enforce them strictly
            if (hasCommandRoleReq || hasCategoryRoleReq) {
                // User must have one of the required roles
                if (!permissionManager.isAuthorized(interaction.user.id, commandName, interaction.guildId, memberRoles)) {
                    // Get roles to mention in the error message
                    let requiredRoles = [];
                    
                    if (hasCommandRoleReq) {
                        const roleIds = permissionManager.getCommandRoles(commandName, interaction.guildId);
                        requiredRoles = roleIds.map(id => {
                            const role = interaction.guild.roles.cache.get(id);
                            return role ? `<@&${id}>` : `Unknown Role (${id})`;
                        });
                    } else if (hasCategoryRoleReq && commandCategory) {
                        const roleIds = permissionManager.getCategoryRoles(commandCategory, interaction.guildId);
                        requiredRoles = roleIds.map(id => {
                            const role = interaction.guild.roles.cache.get(id);
                            return role ? `<@&${id}>` : `Unknown Role (${id})`;
                        });
                    }
                    
                    return interaction.reply({ 
                        embeds: [createEmbed({
                            title: 'Permission Error',
                            description: `You need one of these roles to use this command: ${requiredRoles.join(', ')}`,
                            type: 'error'
                        })],
                        ephemeral: true
                    });
                }
            } else {
                // For commands without role requirements, check normal Discord permissions
                if (command.permissions && command.permissions.length > 0) {
                    // If the command requires specific Discord permissions, check those
                    const hasPermission = command.permissions.some(permission => 
                        interaction.member.permissions.has(permission)
                    );
                    
                    if (!hasPermission) {
                        return interaction.reply({ 
                            embeds: [createEmbed({
                                title: 'Permission Error',
                                description: 'You do not have the required permissions to use this command.',
                                type: 'error'
                            })],
                            ephemeral: true
                        });
                    }
                } else if (command.requiresAuth && !permissionManager.isAuthorized(interaction.user.id, commandName)) {
                    // If command specifically requires authorization but user doesn't have it
                    return interaction.reply({ 
                        embeds: [createEmbed({
                            title: 'Permission Error',
                            description: 'You are not authorized to use this command.',
                            type: 'error'
                        })],
                        ephemeral: true
                    });
                }
            }
        }
        
        try {
            await command.executeSlash(interaction, client);
            logger.info(`${interaction.user.tag} used command: ${commandName}`);
            if (interaction.guild) {
                logger.logToDiscord(client, `${interaction.user.tag} used slash command: ${commandName} in ${interaction.guild.name}`);
            }
        } catch (error) {
            logger.error(`Error executing slash command ${commandName}:`, error);
            
            const errorEmbed = createEmbed({
                title: 'Command Error',
                description: 'There was an error executing that command.',
                type: 'error'
            });
            
            if (interaction.replied || interaction.deferred) {
                await interaction.followUp({ embeds: [errorEmbed], ephemeral: true }).catch(() => {});
            } else {
                await interaction.reply({ embeds: [errorEmbed], ephemeral: true }).catch(() => {});
            }
        }
    },
};
