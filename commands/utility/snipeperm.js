const { SlashCommandBuilder } = require('discord.js');
const { createEmbed } = require('../../utils/embedBuilder');
const snipeManager = require('../../utils/snipeManager');
const logger = require('../../utils/logger');

module.exports = {
    name: 'snipeperm',
    description: 'Manage permissions for cross-channel sniping',
    usage: '<add/remove/list> [role]',
    category: 'utility',
    requiresAuth: true, 
    
    slashCommand: new SlashCommandBuilder()
        .setName('snipeperm')
        .setDescription('Manage permissions for cross-channel sniping')
        .addSubcommand(subcommand =>
            subcommand
                .setName('add')
                .setDescription('Add a role that can snipe across channels')
                .addRoleOption(option => 
                    option.setName('role')
                        .setDescription('Role to grant cross-channel sniping permission')
                        .setRequired(true)))
        .addSubcommand(subcommand =>
            subcommand
                .setName('remove')
                .setDescription('Remove a role from cross-channel sniping permission')
                .addRoleOption(option => 
                    option.setName('role')
                        .setDescription('Role to remove cross-channel sniping permission')
                        .setRequired(true)))
        .addSubcommand(subcommand =>
            subcommand
                .setName('list')
                .setDescription('List all roles that can snipe across channels')),
    
    async execute(message, args, client) {
        // Check if user has permission to manage snipe permissions
        const isServerAdmin = message.member && message.member.permissions.has('ADMINISTRATOR');
        const isOwner = message.author.id === process.env.BOT_OWNER_ID;
        
        if (!isServerAdmin && !isOwner) {
            return message.reply({
                embeds: [createEmbed({
                    title: 'Permission Denied',
                    description: 'You need to be a server administrator to manage snipe permissions.',
                    type: 'error'
                })]
            });
        }
        
        if (!args.length) {
            return message.reply({
                embeds: [createEmbed({
                    title: 'Snipe Permissions Help',
                    description: `Usage: \`!${this.name} ${this.usage}\``,
                    type: 'info',
                    fields: [
                        { name: 'add', value: '`!snipeperm add @role` - Allow a role to snipe across channels' },
                        { name: 'remove', value: '`!snipeperm remove @role` - Remove permission from a role' },
                        { name: 'list', value: '`!snipeperm list` - List all roles with cross-channel sniping permission' }
                    ]
                })]
            });
        }
        
        const subcommand = args[0].toLowerCase();
        const guildId = message.guild.id;
        
        if (subcommand === 'add') {
            if (args.length < 2 || !args[1].match(/^<@&\d+>$/)) {
                return message.reply({
                    embeds: [createEmbed({
                        title: 'Error',
                        description: 'Please mention a valid role to add.',
                        type: 'error'
                    })]
                });
            }
            
            const roleId = args[1].replace(/[<@&>]/g, '');
            const role = message.guild.roles.cache.get(roleId);
            
            if (!role) {
                return message.reply({
                    embeds: [createEmbed({
                        title: 'Error',
                        description: 'Role not found. Please mention a valid role.',
                        type: 'error'
                    })]
                });
            }
            
            const added = snipeManager.addAllowedRole(guildId, roleId);
            
            return message.reply({
                embeds: [createEmbed({
                    title: added ? 'Role Added' : 'Already Added',
                    description: added 
                        ? `Members with the ${role.name} role can now snipe messages across channels.`
                        : `The ${role.name} role already has cross-channel sniping permission.`,
                    type: 'success'
                })]
            });
        }
        
        else if (subcommand === 'remove') {
            if (args.length < 2 || !args[1].match(/^<@&\d+>$/)) {
                return message.reply({
                    embeds: [createEmbed({
                        title: 'Error',
                        description: 'Please mention a valid role to remove.',
                        type: 'error'
                    })]
                });
            }
            
            const roleId = args[1].replace(/[<@&>]/g, '');
            const role = message.guild.roles.cache.get(roleId);
            
            if (!role) {
                return message.reply({
                    embeds: [createEmbed({
                        title: 'Error',
                        description: 'Role not found. Please mention a valid role.',
                        type: 'error'
                    })]
                });
            }
            
            const removed = snipeManager.removeAllowedRole(guildId, roleId);
            
            return message.reply({
                embeds: [createEmbed({
                    title: removed ? 'Role Removed' : 'Not Found',
                    description: removed 
                        ? `The ${role.name} role can no longer snipe messages across channels.`
                        : `The ${role.name} role did not have cross-channel sniping permission.`,
                    type: removed ? 'success' : 'error'
                })]
            });
        }
        
        else if (subcommand === 'list') {
            const allowedRoleIds = snipeManager.getAllowedRoles(guildId);
            
            if (allowedRoleIds.length === 0) {
                return message.reply({
                    embeds: [createEmbed({
                        title: 'Cross-Channel Snipe Permissions',
                        description: 'No roles have been granted cross-channel sniping permission.\n\nNote: Server administrators always have permission regardless of role.',
                        type: 'info'
                    })]
                });
            }
            
            // Get role names from IDs
            const roleNames = allowedRoleIds.map(id => {
                const role = message.guild.roles.cache.get(id);
                return role ? role.name : `Unknown Role (${id})`;
            });
            
            return message.reply({
                embeds: [createEmbed({
                    title: 'Cross-Channel Snipe Permissions',
                    description: 'The following roles can snipe messages across channels:',
                    type: 'info',
                    fields: [
                        { 
                            name: 'Allowed Roles', 
                            value: roleNames.map(name => `• ${name}`).join('\n')
                        },
                        {
                            name: 'Note',
                            value: 'Server administrators always have permission regardless of role.'
                        }
                    ]
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
        // Check if user has permission to manage snipe permissions
        const isServerAdmin = interaction.member && interaction.member.permissions.has('ADMINISTRATOR');
        const isOwner = interaction.user.id === process.env.BOT_OWNER_ID;
        
        if (!isServerAdmin && !isOwner) {
            return interaction.reply({
                embeds: [createEmbed({
                    title: 'Permission Denied',
                    description: 'You need to be a server administrator to manage snipe permissions.',
                    type: 'error'
                })],
                ephemeral: true
            });
        }
        
        const subcommand = interaction.options.getSubcommand();
        const guildId = interaction.guild.id;
        
        if (subcommand === 'add') {
            const role = interaction.options.getRole('role');
            
            if (!role) {
                return interaction.reply({
                    embeds: [createEmbed({
                        title: 'Error',
                        description: 'Role not found. Please select a valid role.',
                        type: 'error'
                    })],
                    ephemeral: true
                });
            }
            
            const added = snipeManager.addAllowedRole(guildId, role.id);
            
            return interaction.reply({
                embeds: [createEmbed({
                    title: added ? 'Role Added' : 'Already Added',
                    description: added 
                        ? `Members with the ${role.name} role can now snipe messages across channels.`
                        : `The ${role.name} role already has cross-channel sniping permission.`,
                    type: 'success'
                })]
            });
        }
        
        else if (subcommand === 'remove') {
            const role = interaction.options.getRole('role');
            
            if (!role) {
                return interaction.reply({
                    embeds: [createEmbed({
                        title: 'Error',
                        description: 'Role not found. Please select a valid role.',
                        type: 'error'
                    })],
                    ephemeral: true
                });
            }
            
            const removed = snipeManager.removeAllowedRole(guildId, role.id);
            
            return interaction.reply({
                embeds: [createEmbed({
                    title: removed ? 'Role Removed' : 'Not Found',
                    description: removed 
                        ? `The ${role.name} role can no longer snipe messages across channels.`
                        : `The ${role.name} role did not have cross-channel sniping permission.`,
                    type: removed ? 'success' : 'error'
                })]
            });
        }
        
        else if (subcommand === 'list') {
            const allowedRoleIds = snipeManager.getAllowedRoles(guildId);
            
            if (allowedRoleIds.length === 0) {
                return interaction.reply({
                    embeds: [createEmbed({
                        title: 'Cross-Channel Snipe Permissions',
                        description: 'No roles have been granted cross-channel sniping permission.\n\nNote: Server administrators always have permission regardless of role.',
                        type: 'info'
                    })]
                });
            }
            
            // Get role names from IDs
            const roleNames = allowedRoleIds.map(id => {
                const role = interaction.guild.roles.cache.get(id);
                return role ? role.name : `Unknown Role (${id})`;
            });
            
            return interaction.reply({
                embeds: [createEmbed({
                    title: 'Cross-Channel Snipe Permissions',
                    description: 'The following roles can snipe messages across channels:',
                    type: 'info',
                    fields: [
                        { 
                            name: 'Allowed Roles', 
                            value: roleNames.map(name => `• ${name}`).join('\n')
                        },
                        {
                            name: 'Note',
                            value: 'Server administrators always have permission regardless of role.'
                        }
                    ]
                })]
            });
        }
    }
};