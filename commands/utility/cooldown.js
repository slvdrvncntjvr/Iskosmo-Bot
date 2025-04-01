const { SlashCommandBuilder } = require('discord.js');
const { createEmbed } = require('../../utils/embedBuilder');
const cooldownManager = require('../../utils/cooldownManager');
const logger = require('../../utils/logger');
const config = require('../../config');

module.exports = {
    name: 'cooldown',
    description: 'View and manage command cooldowns',
    usage: '<list/set/reset/info> [command] [duration]',
    category: 'utility',
    requiresAuth: true, 
    
    slashCommand: new SlashCommandBuilder()
        .setName('cooldown')
        .setDescription('View and manage command cooldowns')
        .addSubcommand(subcommand =>
            subcommand
                .setName('list')
                .setDescription('List all command cooldowns for this server'))
        .addSubcommand(subcommand =>
            subcommand
                .setName('set')
                .setDescription('Set a cooldown for a command')
                .addStringOption(option => 
                    option.setName('command')
                        .setDescription('Command name to set cooldown for')
                        .setRequired(true))
                .addIntegerOption(option => 
                    option.setName('duration')
                        .setDescription('Cooldown duration in seconds (0 to remove)')
                        .setRequired(true)
                        .setMinValue(0)
                        .setMaxValue(3600))) 
        .addSubcommand(subcommand =>
            subcommand
                .setName('reset')
                .setDescription('Reset active cooldowns')
                .addStringOption(option => 
                    option.setName('target')
                        .setDescription('What cooldowns to reset')
                        .setRequired(true)
                        .addChoices(
                            { name: 'All cooldowns in this server', value: 'server' },
                            { name: 'My cooldowns only', value: 'self' },
                            { name: 'Specific command', value: 'command' }
                        ))
                .addStringOption(option => 
                    option.setName('command')
                        .setDescription('Command to reset (if target is "command")')
                        .setRequired(false)))
        .addSubcommand(subcommand =>
            subcommand
                .setName('info')
                .setDescription('Get info about a command\'s cooldown')
                .addStringOption(option => 
                    option.setName('command')
                        .setDescription('Command name to get info about')
                        .setRequired(true))),
    
    async execute(message, args, client) {
        if (!args.length) {
            return message.reply({
                embeds: [createEmbed({
                    title: 'Cooldown Help',
                    description: `Usage: \`!${this.name} ${this.usage}\``,
                    type: 'info',
                    fields: [
                        { name: 'list', value: 'List all command cooldowns for this server' },
                        { name: 'set', value: '`!cooldown set <command> <duration>` - Set cooldown in seconds (0 to remove)' },
                        { name: 'reset', value: '`!cooldown reset <server/self/command> [command]` - Reset active cooldowns' },
                        { name: 'info', value: '`!cooldown info <command>` - Get info about a command\'s cooldown' }
                    ]
                })]
            });
        }
        
        const subcommand = args[0].toLowerCase();
        
        if (subcommand === 'list') {
            const guildId = message.guild ? message.guild.id : null;
            const cooldowns = cooldownManager.listCooldowns(guildId);
            
            if (Object.keys(cooldowns).length === 0) {
                return message.reply({
                    embeds: [createEmbed({
                        title: 'Command Cooldowns',
                        description: 'No cooldowns are configured for any commands.',
                        type: 'info'
                    })]
                });
            }

            const groupedByDuration = {};
            
            for (const [command, info] of Object.entries(cooldowns)) {
                const key = `${info.duration}s (${info.source})`;
                if (!groupedByDuration[key]) {
                    groupedByDuration[key] = [];
                }
                groupedByDuration[key].push(command);
            }
            
            const fields = Object.entries(groupedByDuration).map(([duration, commands]) => ({
                name: duration,
                value: commands.sort().join(', ')
            }));

            const activeCooldowns = cooldownManager.getUserActiveCooldowns(message.author.id, guildId);
            
            if (activeCooldowns.length > 0) {
                fields.push({
                    name: '🔄 Your Active Cooldowns',
                    value: activeCooldowns
                        .map(c => `${c.command}: ${c.remaining}s remaining`)
                        .join('\n')
                });
            }
            
            return message.reply({
                embeds: [createEmbed({
                    title: 'Command Cooldowns',
                    description: `This server has ${Object.keys(cooldowns).length} commands with cooldowns configured.`,
                    type: 'info',
                    fields
                })]
            });
        }
        
        else if (subcommand === 'set') {
            const isServerAdmin = message.member && message.member.permissions.has('ADMINISTRATOR');
            const isOwner = message.author.id === process.env.BOT_OWNER_ID;
            
            if (!isServerAdmin && !isOwner) {
                return message.reply({
                    embeds: [createEmbed({
                        title: 'Permission Denied',
                        description: 'You need to be a server administrator to set cooldowns.',
                        type: 'error'
                    })]
                });
            }
            
            if (args.length < 3) {
                return message.reply({
                    embeds: [createEmbed({
                        title: 'Error',
                        description: 'You need to provide both a command name and a duration.',
                        type: 'error'
                    })]
                });
            }
            
            const commandName = args[1].toLowerCase();
            const duration = parseInt(args[2], 10);
            
            if (isNaN(duration) || duration < 0) {
                return message.reply({
                    embeds: [createEmbed({
                        title: 'Error',
                        description: 'Duration must be a positive number (or 0 to remove cooldown).',
                        type: 'error'
                    })]
                });
            }

            const commandExists = client.commands.has(commandName);
            
            if (!commandExists) {
                return message.reply({
                    embeds: [createEmbed({
                        title: 'Warning',
                        description: `Command "${commandName}" doesn't exist. Setting cooldown anyway.`,
                        type: 'warning'
                    })]
                });
            }
            
            const guildId = message.guild ? message.guild.id : null;
            
            if (duration === 0) {
                const removed = cooldownManager.removeCooldownDuration(commandName, guildId);
                
                return message.reply({
                    embeds: [createEmbed({
                        title: 'Cooldown Removed',
                        description: removed 
                            ? `Removed cooldown for "${commandName}" command.`
                            : `No custom cooldown was set for "${commandName}" command.`,
                        type: 'success'
                    })]
                });
            } else {
                cooldownManager.setCooldownDuration(commandName, duration, guildId);
                
                return message.reply({
                    embeds: [createEmbed({
                        title: 'Cooldown Set',
                        description: `Set a ${duration} second cooldown for the "${commandName}" command.`,
                        type: 'success'
                    })]
                });
            }
        }
        
        else if (subcommand === 'reset') {
            if (args.length < 2) {
                return message.reply({
                    embeds: [createEmbed({
                        title: 'Error',
                        description: 'Please specify what to reset: server, self, or command.',
                        type: 'error'
                    })]
                });
            }
            
            const target = args[1].toLowerCase();
            const guildId = message.guild ? message.guild.id : null;

            if (target === 'server') {
                const isServerAdmin = message.member && message.member.permissions.has('ADMINISTRATOR');
                const isOwner = message.author.id === process.env.BOT_OWNER_ID;
                
                if (!isServerAdmin && !isOwner) {
                    return message.reply({
                        embeds: [createEmbed({
                            title: 'Permission Denied',
                            description: 'You need to be a server administrator to reset all cooldowns.',
                            type: 'error'
                        })]
                    });
                }
                
                const count = cooldownManager.resetGuildCooldowns(guildId);
                
                return message.reply({
                    embeds: [createEmbed({
                        title: 'Cooldowns Reset',
                        description: `Reset ${count} active cooldown${count === 1 ? '' : 's'} for this server.`,
                        type: 'success'
                    })]
                });
            }
            
            else if (target === 'self') {
                const count = cooldownManager.resetUserCooldowns(message.author.id);
                
                return message.reply({
                    embeds: [createEmbed({
                        title: 'Cooldowns Reset',
                        description: `Reset ${count} of your active cooldown${count === 1 ? '' : 's'}.`,
                        type: 'success'
                    })]
                });
            }
            
            else if (target === 'command') {
                if (args.length < 3) {
                    return message.reply({
                        embeds: [createEmbed({
                            title: 'Error',
                            description: 'Please specify which command to reset.',
                            type: 'error'
                        })]
                    });
                }
                
                const commandName = args[2].toLowerCase();
                const reset = cooldownManager.resetCooldown(commandName, message.author.id, guildId);
                
                return message.reply({
                    embeds: [createEmbed({
                        title: reset ? 'Cooldown Reset' : 'No Active Cooldown',
                        description: reset 
                            ? `Reset your cooldown for the "${commandName}" command.`
                            : `You don't have an active cooldown for the "${commandName}" command.`,
                        type: reset ? 'success' : 'info'
                    })]
                });
            }
            
            else {
                return message.reply({
                    embeds: [createEmbed({
                        title: 'Error',
                        description: 'Invalid reset target. Use "server", "self", or "command".',
                        type: 'error'
                    })]
                });
            }
        }
        
        else if (subcommand === 'info') {
            if (args.length < 2) {
                return message.reply({
                    embeds: [createEmbed({
                        title: 'Error',
                        description: 'Please specify which command to get info about.',
                        type: 'error'
                    })]
                });
            }
            
            const commandName = args[1].toLowerCase();
            const guildId = message.guild ? message.guild.id : null;
            
            // Check if command exists
            const command = client.commands.get(commandName);
            
            if (!command) {
                return message.reply({
                    embeds: [createEmbed({
                        title: 'Error',
                        description: `Command "${commandName}" doesn't exist.`,
                        type: 'error'
                    })]
                });
            }
            
            const globalDuration = cooldownManager.getCooldownDuration(commandName, null);
            const guildDuration = guildId ? cooldownManager.getCooldownDuration(commandName, guildId) : null;
            const effectiveDuration = cooldownManager.getCooldownDuration(commandName, guildId);
            
            // Check if user has an active cooldown
            const remainingTime = cooldownManager.checkCooldown(commandName, message.author.id, guildId);
            
            const fields = [
                { 
                    name: 'Global Cooldown', 
                    value: globalDuration > 0 ? `${globalDuration} seconds` : 'None',
                    inline: true
                }
            ];
            
            if (guildId) {
                fields.push({ 
                    name: 'Server Override', 
                    value: guildDuration !== null ? `${guildDuration} seconds` : 'None',
                    inline: true
                });
            }
            
            fields.push({ 
                name: 'Effective Cooldown', 
                value: effectiveDuration > 0 ? `${effectiveDuration} seconds` : 'None',
                inline: true
            });
            
            if (remainingTime > 0) {
                fields.push({ 
                    name: 'Your Status', 
                    value: `On cooldown for ${remainingTime} more second${remainingTime === 1 ? '' : 's'}`,
                    inline: false
                });
            } else if (effectiveDuration > 0) {
                fields.push({ 
                    name: 'Your Status', 
                    value: 'Ready to use',
                    inline: false
                });
            }
            
            return message.reply({
                embeds: [createEmbed({
                    title: `Cooldown Info: ${commandName}`,
                    description: `Cooldown information for the "${commandName}" command.`,
                    type: 'info',
                    fields
                })]
            });
        }
        
        else {
            return message.reply({
                embeds: [createEmbed({
                    title: 'Error',
                    description: `Unknown subcommand "${subcommand}". Use \`!${this.name}\` for help.`,
                    type: 'error'
                })]
            });
        }
    },
    
    async executeSlash(interaction, client) {
        const subcommand = interaction.options.getSubcommand();
        
        if (subcommand === 'list') {
            const guildId = interaction.guild ? interaction.guild.id : null;
            const cooldowns = cooldownManager.listCooldowns(guildId);
            
            if (Object.keys(cooldowns).length === 0) {
                return interaction.reply({
                    embeds: [createEmbed({
                        title: 'Command Cooldowns',
                        description: 'No cooldowns are configured for any commands.',
                        type: 'info'
                    })]
                });
            }
            
            // Group by duration for more readable output
            const groupedByDuration = {};
            
            for (const [command, info] of Object.entries(cooldowns)) {
                const key = `${info.duration}s (${info.source})`;
                if (!groupedByDuration[key]) {
                    groupedByDuration[key] = [];
                }
                groupedByDuration[key].push(command);
            }
            
            const fields = Object.entries(groupedByDuration).map(([duration, commands]) => ({
                name: duration,
                value: commands.sort().join(', ')
            }));
            
                       // Add active cooldowns for the user
                       const activeCooldowns = cooldownManager.getUserActiveCooldowns(interaction.user.id, guildId);
            
                       if (activeCooldowns.length > 0) {
                           fields.push({
                               name: '🔄 Your Active Cooldowns',
                               value: activeCooldowns
                                   .map(c => `${c.command}: ${c.remaining}s remaining`)
                                   .join('\n')
                           });
                       }
                       
                       return interaction.reply({
                           embeds: [createEmbed({
                               title: 'Command Cooldowns',
                               description: `This server has ${Object.keys(cooldowns).length} commands with cooldowns configured.`,
                               type: 'info',
                               fields
                           })]
                       });
                   }
                   
                   else if (subcommand === 'set') {
                       // Check if user has permission to set cooldowns
                       const isServerAdmin = interaction.member && interaction.member.permissions.has('ADMINISTRATOR');
                       const isOwner = interaction.user.id === process.env.BOT_OWNER_ID;
                       
                       if (!isServerAdmin && !isOwner) {
                           return interaction.reply({
                               embeds: [createEmbed({
                                   title: 'Permission Denied',
                                   description: 'You need to be a server administrator to set cooldowns.',
                                   type: 'error'
                               })],
                               ephemeral: true
                           });
                       }
                       
                       const commandName = interaction.options.getString('command').toLowerCase();
                       const duration = interaction.options.getInteger('duration');
                       
                       // Check if command exists
                       const commandExists = client.commands.has(commandName);
                       
                       if (!commandExists) {
                           return interaction.reply({
                               embeds: [createEmbed({
                                   title: 'Warning',
                                   description: `Command "${commandName}" doesn't exist. Setting cooldown anyway.`,
                                   type: 'warning'
                               })]
                           });
                       }
                       
                       const guildId = interaction.guild ? interaction.guild.id : null;
                       
                       if (duration === 0) {
                           // Remove cooldown
                           const removed = cooldownManager.removeCooldownDuration(commandName, guildId);
                           
                           return interaction.reply({
                               embeds: [createEmbed({
                                   title: 'Cooldown Removed',
                                   description: removed 
                                       ? `Removed cooldown for "${commandName}" command.`
                                       : `No custom cooldown was set for "${commandName}" command.`,
                                   type: 'success'
                               })]
                           });
                       } else {
                           // Set cooldown
                           cooldownManager.setCooldownDuration(commandName, duration, guildId);
                           
                           return interaction.reply({
                               embeds: [createEmbed({
                                   title: 'Cooldown Set',
                                   description: `Set a ${duration} second cooldown for the "${commandName}" command.`,
                                   type: 'success'
                               })]
                           });
                       }
                   }
                   
                   else if (subcommand === 'reset') {
                       const target = interaction.options.getString('target');
                       const guildId = interaction.guild ? interaction.guild.id : null;
                       
                       // Check permissions for server-wide reset
                       if (target === 'server') {
                           const isServerAdmin = interaction.member && interaction.member.permissions.has('ADMINISTRATOR');
                           const isOwner = interaction.user.id === process.env.BOT_OWNER_ID;
                           
                           if (!isServerAdmin && !isOwner) {
                               return interaction.reply({
                                   embeds: [createEmbed({
                                       title: 'Permission Denied',
                                       description: 'You need to be a server administrator to reset all cooldowns.',
                                       type: 'error'
                                   })],
                                   ephemeral: true
                               });
                           }
                           
                           const count = cooldownManager.resetGuildCooldowns(guildId);
                           
                           return interaction.reply({
                               embeds: [createEmbed({
                                   title: 'Cooldowns Reset',
                                   description: `Reset ${count} active cooldown${count === 1 ? '' : 's'} for this server.`,
                                   type: 'success'
                               })]
                           });
                       }
                       
                       else if (target === 'self') {
                           const count = cooldownManager.resetUserCooldowns(interaction.user.id);
                           
                           return interaction.reply({
                               embeds: [createEmbed({
                                   title: 'Cooldowns Reset',
                                   description: `Reset ${count} of your active cooldown${count === 1 ? '' : 's'}.`,
                                   type: 'success'
                               })]
                           });
                       }
                       
                       else if (target === 'command') {
                           const commandName = interaction.options.getString('command');
                           
                           if (!commandName) {
                               return interaction.reply({
                                   embeds: [createEmbed({
                                       title: 'Error',
                                       description: 'Please specify which command to reset.',
                                       type: 'error'
                                   })],
                                   ephemeral: true
                               });
                           }
                           
                           const reset = cooldownManager.resetCooldown(commandName.toLowerCase(), interaction.user.id, guildId);
                           
                           return interaction.reply({
                               embeds: [createEmbed({
                                   title: reset ? 'Cooldown Reset' : 'No Active Cooldown',
                                   description: reset 
                                       ? `Reset your cooldown for the "${commandName}" command.`
                                       : `You don't have an active cooldown for the "${commandName}" command.`,
                                   type: reset ? 'success' : 'info'
                               })]
                           });
                       }
                   }
                   
                   else if (subcommand === 'info') {
                       const commandName = interaction.options.getString('command').toLowerCase();
                       const guildId = interaction.guild ? interaction.guild.id : null;
                       
                       // Check if command exists
                       const command = client.commands.get(commandName);
                       
                       if (!command) {
                           return interaction.reply({
                               embeds: [createEmbed({
                                   title: 'Error',
                                   description: `Command "${commandName}" doesn't exist.`,
                                   type: 'error'
                               })],
                               ephemeral: true
                           });
                       }
                       
                       const globalDuration = cooldownManager.getCooldownDuration(commandName, null);
                       const guildDuration = guildId ? cooldownManager.getCooldownDuration(commandName, guildId) : null;
                       const effectiveDuration = cooldownManager.getCooldownDuration(commandName, guildId);
                       
                       // Check if user has an active cooldown
                       const remainingTime = cooldownManager.checkCooldown(commandName, interaction.user.id, guildId);
                       
                       const fields = [
                           { 
                               name: 'Global Cooldown', 
                               value: globalDuration > 0 ? `${globalDuration} seconds` : 'None',
                               inline: true
                           }
                       ];
                       
                       if (guildId) {
                           fields.push({ 
                               name: 'Server Override', 
                               value: guildDuration !== null ? `${guildDuration} seconds` : 'None',
                               inline: true
                           });
                       }
                       
                       fields.push({ 
                           name: 'Effective Cooldown', 
                           value: effectiveDuration > 0 ? `${effectiveDuration} seconds` : 'None',
                           inline: true
                       });
                       
                       if (remainingTime > 0) {
                           fields.push({ 
                               name: 'Your Status', 
                               value: `On cooldown for ${remainingTime} more second${remainingTime === 1 ? '' : 's'}`,
                               inline: false
                           });
                       } else if (effectiveDuration > 0) {
                           fields.push({ 
                               name: 'Your Status', 
                               value: 'Ready to use',
                               inline: false
                           });
                       }
                       
                       return interaction.reply({
                           embeds: [createEmbed({
                               title: `Cooldown Info: ${commandName}`,
                               description: `Cooldown information for the "${commandName}" command.`,
                               type: 'info',
                               fields
                           })]
                       });
                   }
               }
           };