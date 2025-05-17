const { SlashCommandBuilder } = require('discord.js');
const { createEmbed } = require('../../utils/embedBuilder');
const permissionManager = require('../../utils/permissionManager');
const logger = require('../../utils/logger');
const path = require('path');
const fs = require('fs');

// Path to store suspended guild operations
const SUSPEND_FILE = path.join(__dirname, '../../data/suspendedGuilds.json');

// Helper function to get suspended guilds
const getSuspendedGuilds = () => {
    try {
        if (fs.existsSync(SUSPEND_FILE)) {
            return JSON.parse(fs.readFileSync(SUSPEND_FILE, 'utf8'));
        }
    } catch (error) {
        logger.error('Error reading suspended guilds file:', error);
    }
    return {};
};

// Helper function to save suspended guilds
const saveSuspendedGuilds = (guilds) => {
    try {
        fs.writeFileSync(SUSPEND_FILE, JSON.stringify(guilds, null, 2), 'utf8');
        return true;
    } catch (error) {
        logger.error('Error saving suspended guilds:', error);
        return false;
    }
};

module.exports = {
    name: 'servers',
    description: 'Manage servers the bot is in (owners only)',
    usage: '<list/leave/suspend/resume>',
    category: 'utility',
    ownerOnly: true,
    
    slashCommand: new SlashCommandBuilder()
        .setName('servers')
        .setDescription('Manage servers the bot is in (owners only)')
        .addSubcommand(subcommand =>
            subcommand
                .setName('list')
                .setDescription('List all servers the bot is in'))
        .addSubcommand(subcommand =>
            subcommand
                .setName('leave')
                .setDescription('Leave a server')
                .addStringOption(option =>
                    option.setName('server_id')
                        .setDescription('The ID of the server to leave')
                        .setRequired(true)))
        .addSubcommand(subcommand =>
            subcommand
                .setName('suspend')
                .setDescription('Suspend bot operations in a server')
                .addStringOption(option =>
                    option.setName('server_id')
                        .setDescription('The ID of the server to suspend operations in')
                        .setRequired(true))
                .addStringOption(option =>
                    option.setName('reason')
                        .setDescription('Reason for suspending operations')
                        .setRequired(false)))
        .addSubcommand(subcommand =>
            subcommand
                .setName('resume')
                .setDescription('Resume bot operations in a server')
                .addStringOption(option =>
                    option.setName('server_id')
                        .setDescription('The ID of the server to resume operations in')
                        .setRequired(true))),
    
    async execute(message, args, client) {
        // Only bot owners can use this command
        if (!permissionManager.isOwner(message.author.id)) {
            return message.reply({
                embeds: [createEmbed({
                    title: 'Permission Denied',
                    description: 'Only bot owners can use this command.',
                    type: 'error'
                })]
            });
        }

        if (!args.length) {
            return message.reply({
                embeds: [createEmbed({
                    title: 'Error',
                    description: `Usage: \`!${this.name} ${this.usage}\``,
                    type: 'error'
                })]
            });
        }
        
        const action = args[0].toLowerCase();
        
        if (action === 'list') {
            return this.listServers(message, client);
        } else if (action === 'leave') {
            if (!args[1]) {
                return message.reply({
                    embeds: [createEmbed({
                        title: 'Error',
                        description: 'Please provide a server ID.',
                        type: 'error'
                    })]
                });
            }
            return this.leaveServer(message, client, args[1]);
        } else if (action === 'suspend') {
            if (!args[1]) {
                return message.reply({
                    embeds: [createEmbed({
                        title: 'Error',
                        description: 'Please provide a server ID.',
                        type: 'error'
                    })]
                });
            }
            const reason = args.slice(2).join(' ') || 'No reason provided';
            return this.suspendServer(message, client, args[1], reason);
        } else if (action === 'resume') {
            if (!args[1]) {
                return message.reply({
                    embeds: [createEmbed({
                        title: 'Error',
                        description: 'Please provide a server ID.',
                        type: 'error'
                    })]
                });
            }
            return this.resumeServer(message, client, args[1]);
        } else {
            return message.reply({
                embeds: [createEmbed({
                    title: 'Error',
                    description: 'Valid actions are: `list`, `leave`, `suspend`, and `resume`.',
                    type: 'error'
                })]
            });
        }
    },
    
    async executeSlash(interaction, client) {
        // Only bot owners can use this command
        if (!permissionManager.isOwner(interaction.user.id)) {
            return interaction.reply({
                embeds: [createEmbed({
                    title: 'Permission Denied',
                    description: 'Only bot owners can use this command.',
                    type: 'error'
                })],
                ephemeral: true
            });
        }
        
        const subcommand = interaction.options.getSubcommand();
        
        if (subcommand === 'list') {
            return this.listServersSlash(interaction, client);
        } else if (subcommand === 'leave') {
            const serverId = interaction.options.getString('server_id');
            return this.leaveServerSlash(interaction, client, serverId);
        } else if (subcommand === 'suspend') {
            const serverId = interaction.options.getString('server_id');
            const reason = interaction.options.getString('reason') || 'No reason provided';
            return this.suspendServerSlash(interaction, client, serverId, reason);
        } else if (subcommand === 'resume') {
            const serverId = interaction.options.getString('server_id');
            return this.resumeServerSlash(interaction, client, serverId);
        }
    },
    
    // Helper methods for text commands
    async listServers(message, client) {
        const guilds = Array.from(client.guilds.cache.values());
        const suspendedGuilds = getSuspendedGuilds();
        
        if (guilds.length === 0) {
            return message.reply({
                embeds: [createEmbed({
                    title: 'Server List',
                    description: 'The bot is not in any servers.',
                    type: 'info'
                })]
            });
        }
        
        // Sort guilds by member count
        guilds.sort((a, b) => b.memberCount - a.memberCount);
        
        // Build detailed list with pagination if needed
        const guildsList = guilds.map(guild => {
            const suspended = suspendedGuilds[guild.id] ? ' ⚠️ SUSPENDED' : '';
            return `• ${guild.name} (${guild.id})${suspended}\n  Members: ${guild.memberCount} | Owner: <@${guild.ownerId}> (${guild.ownerId})\n`;
        }).join('\n');
        
        return message.reply({
            embeds: [createEmbed({
                title: `Server List (${guilds.length} servers)`,
                description: guildsList,
                type: 'info',
                footer: { text: 'Server ID can be used with leave, suspend, and resume commands' }
            })]
        });
    },
    
    async leaveServer(message, client, serverId) {
        const guild = client.guilds.cache.get(serverId);
        
        if (!guild) {
            return message.reply({
                embeds: [createEmbed({
                    title: 'Error',
                    description: `Could not find a server with ID \`${serverId}\`.`,
                    type: 'error'
                })]
            });
        }
        
        const guildName = guild.name;
        
        try {
            await guild.leave();
            logger.info(`Bot left server ${guildName} (${serverId}) by command from ${message.author.tag}`);
            
            return message.reply({
                embeds: [createEmbed({
                    title: 'Server Left',
                    description: `Successfully left server **${guildName}** (${serverId}).`,
                    type: 'success'
                })]
            });
        } catch (error) {
            logger.error(`Error leaving server ${serverId}:`, error);
            
            return message.reply({
                embeds: [createEmbed({
                    title: 'Error',
                    description: `Failed to leave server: ${error.message}`,
                    type: 'error'
                })]
            });
        }
    },
    
    async suspendServer(message, client, serverId, reason) {
        const guild = client.guilds.cache.get(serverId);
        
        if (!guild) {
            return message.reply({
                embeds: [createEmbed({
                    title: 'Error',
                    description: `Could not find a server with ID \`${serverId}\`.`,
                    type: 'error'
                })]
            });
        }
        
        const suspendedGuilds = getSuspendedGuilds();
        
        if (suspendedGuilds[serverId]) {
            return message.reply({
                embeds: [createEmbed({
                    title: 'Already Suspended',
                    description: `Operations in server **${guild.name}** are already suspended.`,
                    type: 'info'
                })]
            });
        }
        
        suspendedGuilds[serverId] = {
            timestamp: Date.now(),
            reason,
            suspendedBy: message.author.id
        };
        
        saveSuspendedGuilds(suspendedGuilds);
        logger.info(`Bot operations suspended in server ${guild.name} (${serverId}) by ${message.author.tag}: ${reason}`);
        
        return message.reply({
            embeds: [createEmbed({
                title: 'Server Suspended',
                description: `Successfully suspended operations in server **${guild.name}**.`,
                fields: [
                    { name: 'Server ID', value: serverId },
                    { name: 'Reason', value: reason }
                ],
                type: 'success'
            })]
        });
    },
    
    async resumeServer(message, client, serverId) {
        const guild = client.guilds.cache.get(serverId);
        const suspendedGuilds = getSuspendedGuilds();
        
        if (!suspendedGuilds[serverId]) {
            return message.reply({
                embeds: [createEmbed({
                    title: 'Not Suspended',
                    description: `Operations in server ${guild ? `**${guild.name}**` : serverId} are not suspended.`,
                    type: 'info'
                })]
            });
        }
        
        delete suspendedGuilds[serverId];
        saveSuspendedGuilds(suspendedGuilds);
        
        logger.info(`Bot operations resumed in server ${guild ? guild.name : serverId} by ${message.author.tag}`);
        
        return message.reply({
            embeds: [createEmbed({
                title: 'Server Resumed',
                description: `Successfully resumed operations in server ${guild ? `**${guild.name}**` : serverId}.`,
                type: 'success'
            })]
        });
    },
    
    // Helper methods for slash commands
    async listServersSlash(interaction, client) {
        const guilds = Array.from(client.guilds.cache.values());
        const suspendedGuilds = getSuspendedGuilds();
        
        if (guilds.length === 0) {
            return interaction.reply({
                embeds: [createEmbed({
                    title: 'Server List',
                    description: 'The bot is not in any servers.',
                    type: 'info'
                })]
            });
        }
        
        // Sort guilds by member count
        guilds.sort((a, b) => b.memberCount - a.memberCount);
        
        // Build detailed list with pagination if needed
        const guildsList = guilds.map(guild => {
            const suspended = suspendedGuilds[guild.id] ? ' ⚠️ SUSPENDED' : '';
            return `• ${guild.name} (${guild.id})${suspended}\n  Members: ${guild.memberCount} | Owner: <@${guild.ownerId}> (${guild.ownerId})\n`;
        }).join('\n');
        
        return interaction.reply({
            embeds: [createEmbed({
                title: `Server List (${guilds.length} servers)`,
                description: guildsList,
                type: 'info',
                footer: { text: 'Server ID can be used with leave, suspend, and resume commands' }
            })]
        });
    },
    
    async leaveServerSlash(interaction, client, serverId) {
        const guild = client.guilds.cache.get(serverId);
        
        if (!guild) {
            return interaction.reply({
                embeds: [createEmbed({
                    title: 'Error',
                    description: `Could not find a server with ID \`${serverId}\`.`,
                    type: 'error'
                })],
                ephemeral: true
            });
        }
        
        const guildName = guild.name;
        
        try {
            await guild.leave();
            logger.info(`Bot left server ${guildName} (${serverId}) by command from ${interaction.user.tag}`);
            
            return interaction.reply({
                embeds: [createEmbed({
                    title: 'Server Left',
                    description: `Successfully left server **${guildName}** (${serverId}).`,
                    type: 'success'
                })]
            });
        } catch (error) {
            logger.error(`Error leaving server ${serverId}:`, error);
            
            return interaction.reply({
                embeds: [createEmbed({
                    title: 'Error',
                    description: `Failed to leave server: ${error.message}`,
                    type: 'error'
                })],
                ephemeral: true
            });
        }
    },
    
    async suspendServerSlash(interaction, client, serverId, reason) {
        const guild = client.guilds.cache.get(serverId);
        
        if (!guild) {
            return interaction.reply({
                embeds: [createEmbed({
                    title: 'Error',
                    description: `Could not find a server with ID \`${serverId}\`.`,
                    type: 'error'
                })],
                ephemeral: true
            });
        }
        
        const suspendedGuilds = getSuspendedGuilds();
        
        if (suspendedGuilds[serverId]) {
            return interaction.reply({
                embeds: [createEmbed({
                    title: 'Already Suspended',
                    description: `Operations in server **${guild.name}** are already suspended.`,
                    type: 'info'
                })],
                ephemeral: true
            });
        }
        
        suspendedGuilds[serverId] = {
            timestamp: Date.now(),
            reason,
            suspendedBy: interaction.user.id
        };
        
        saveSuspendedGuilds(suspendedGuilds);
        logger.info(`Bot operations suspended in server ${guild.name} (${serverId}) by ${interaction.user.tag}: ${reason}`);
        
        return interaction.reply({
            embeds: [createEmbed({
                title: 'Server Suspended',
                description: `Successfully suspended operations in server **${guild.name}**.`,
                fields: [
                    { name: 'Server ID', value: serverId },
                    { name: 'Reason', value: reason }
                ],
                type: 'success'
            })]
        });
    },
    
    async resumeServerSlash(interaction, client, serverId) {
        const guild = client.guilds.cache.get(serverId);
        const suspendedGuilds = getSuspendedGuilds();
        
        if (!suspendedGuilds[serverId]) {
            return interaction.reply({
                embeds: [createEmbed({
                    title: 'Not Suspended',
                    description: `Operations in server ${guild ? `**${guild.name}**` : serverId} are not suspended.`,
                    type: 'info'
                })],
                ephemeral: true
            });
        }
        
        delete suspendedGuilds[serverId];
        saveSuspendedGuilds(suspendedGuilds);
        
        logger.info(`Bot operations resumed in server ${guild ? guild.name : serverId} by ${interaction.user.tag}`);
        
        return interaction.reply({
            embeds: [createEmbed({
                title: 'Server Resumed',
                description: `Successfully resumed operations in server ${guild ? `**${guild.name}**` : serverId}.`,
                type: 'success'
            })]
        });
    }
};