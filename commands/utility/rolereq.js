const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const { createEmbed } = require('../../utils/embedBuilder');
const permissionManager = require('../../utils/permissionManager');
const logger = require('../../utils/logger');

module.exports = {
    name: 'rolereq',
    description: 'Manage role requirements for commands',
    usage: '<add/remove/list> <command/category> <role mention or ID>',
    category: 'utility',
    guildOnly: true,
    permissions: [PermissionFlagsBits.Administrator],
    
    slashCommand: new SlashCommandBuilder()
        .setName('rolereq')
        .setDescription('Manage role requirements for commands')
        .addSubcommand(subcommand =>
            subcommand
                .setName('add')
                .setDescription('Require a role to use a command')
                .addStringOption(option =>
                    option.setName('type')
                        .setDescription('Target a command or a category')
                        .setRequired(true)
                        .addChoices(
                            { name: 'Command', value: 'command' },
                            { name: 'Category', value: 'category' }
                        ))
                .addStringOption(option =>
                    option.setName('target')
                        .setDescription('The command name or category name')
                        .setRequired(true))
                .addRoleOption(option =>
                    option.setName('role')
                        .setDescription('The role required to use the command')
                        .setRequired(true)))
        .addSubcommand(subcommand =>
            subcommand
                .setName('remove')
                .setDescription('Remove a role requirement from a command')
                .addStringOption(option =>
                    option.setName('type')
                        .setDescription('Target a command or a category')
                        .setRequired(true)
                        .addChoices(
                            { name: 'Command', value: 'command' },
                            { name: 'Category', value: 'category' }
                        ))
                .addStringOption(option =>
                    option.setName('target')
                        .setDescription('The command name or category name')
                        .setRequired(true))
                .addRoleOption(option =>
                    option.setName('role')
                        .setDescription('The role to remove from requirements')
                        .setRequired(true)))
        .addSubcommand(subcommand =>
            subcommand
                .setName('list')
                .setDescription('List role requirements')
                .addStringOption(option =>
                    option.setName('type')
                        .setDescription('List by command or category')
                        .setRequired(true)
                        .addChoices(
                            { name: 'Command', value: 'command' },
                            { name: 'Category', value: 'category' },
                            { name: 'All', value: 'all' }
                        ))
                .addStringOption(option =>
                    option.setName('target')
                        .setDescription('The command name or category name (not needed for "all")')
                        .setRequired(false)))
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
    
    // Implementation of the command logic for text commands
    async execute(message, args, client) {
        // Check if user is server admin or bot owner/operator
        if (!message.member.permissions.has(PermissionFlagsBits.Administrator) && 
            !permissionManager.isOperator(message.author.id)) {
            return message.reply({
                embeds: [createEmbed({
                    title: 'Permission Denied',
                    description: 'You need Administrator permission to manage role requirements.',
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
        
        if (!['add', 'remove', 'list'].includes(action)) {
            return message.reply({
                embeds: [createEmbed({
                    title: 'Error',
                    description: 'Please specify `add`, `remove`, or `list` as the action.',
                    type: 'error'
                })]
            });
        }
        
        if (action === 'list') {
            // Handle list action
            const type = args[1]?.toLowerCase();
            
            if (!type || !['command', 'category', 'all'].includes(type)) {
                return message.reply({
                    embeds: [createEmbed({
                        title: 'Error',
                        description: 'Please specify `command`, `category`, or `all` as the type.',
                        type: 'error'
                    })]
                });
            }
            
            if (type === 'all') {
                return this.listAllRequirements(message);
            }
            
            const target = args[2]?.toLowerCase();
            
            if (!target) {
                return message.reply({
                    embeds: [createEmbed({
                        title: 'Error',
                        description: `Please specify a ${type} name.`,
                        type: 'error'
                    })]
                });
            }
            
            if (type === 'command') {
                return this.listCommandRequirements(message, target);
            } else {
                return this.listCategoryRequirements(message, target);
            }
        }
        
        // For add and remove, we need more arguments
        if (args.length < 4) {
            return message.reply({
                embeds: [createEmbed({
                    title: 'Error',
                    description: `Usage: \`!${this.name} ${action} <command/category> <target> <role>\``,
                    type: 'error'
                })]
            });
        }
        
        const type = args[1].toLowerCase();
        
        if (!['command', 'category'].includes(type)) {
            return message.reply({
                embeds: [createEmbed({
                    title: 'Error',
                    description: 'Please specify `command` or `category` as the type.',
                    type: 'error'
                })]
            });
        }
        
        const target = args[2].toLowerCase();
        
        // Validate target exists if it's a command
        if (type === 'command' && !client.commands.has(target)) {
            return message.reply({
                embeds: [createEmbed({
                    title: 'Error',
                    description: `Command \`${target}\` does not exist.`,
                    type: 'error'
                })]
            });
        }
        
        // Extract role from mention or ID
        const roleId = args[3].replace(/[<@&>]/g, '');
        const role = message.guild.roles.cache.get(roleId);
        
        if (!role) {
            return message.reply({
                embeds: [createEmbed({
                    title: 'Error',
                    description: 'Please specify a valid role mention or ID.',
                    type: 'error'
                })]
            });
        }
        
        if (action === 'add') {
            if (type === 'command') {
                return this.addCommandRole(message, target, role);
            } else {
                return this.addCategoryRole(message, target, role);
            }
        } else if (action === 'remove') {
            if (type === 'command') {
                return this.removeCommandRole(message, target, role);
            } else {
                return this.removeCategoryRole(message, target, role);
            }
        }
    },
    
    // Implementation for slash commands
    async executeSlash(interaction, client) {
        // Check if user is server admin or bot owner/operator
        if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator) && 
            !permissionManager.isOperator(interaction.user.id)) {
            return interaction.reply({
                embeds: [createEmbed({
                    title: 'Permission Denied',
                    description: 'You need Administrator permission to manage role requirements.',
                    type: 'error'
                })],
                ephemeral: true
            });
        }
        
        const subcommand = interaction.options.getSubcommand();
        
        if (subcommand === 'list') {
            const type = interaction.options.getString('type');
            const target = interaction.options.getString('target');
            
            if (type === 'all') {
                return this.listAllRequirementsSlash(interaction);
            }
            
            if (!target) {
                return interaction.reply({
                    embeds: [createEmbed({
                        title: 'Error',
                        description: `Please specify a ${type} name.`,
                        type: 'error'
                    })],
                    ephemeral: true
                });
            }
            
            if (type === 'command') {
                return this.listCommandRequirementsSlash(interaction, target);
            } else {
                return this.listCategoryRequirementsSlash(interaction, target);
            }
        }
        
        const type = interaction.options.getString('type');
        const target = interaction.options.getString('target').toLowerCase();
        const role = interaction.options.getRole('role');
        
        // Validate target exists if it's a command
        if (type === 'command' && !client.commands.has(target)) {
            return interaction.reply({
                embeds: [createEmbed({
                    title: 'Error',
                    description: `Command \`${target}\` does not exist.`,
                    type: 'error'
                })],
                ephemeral: true
            });
        }
        
        if (subcommand === 'add') {
            if (type === 'command') {
                return this.addCommandRoleSlash(interaction, target, role);
            } else {
                return this.addCategoryRoleSlash(interaction, target, role);
            }
        } else if (subcommand === 'remove') {
            if (type === 'command') {
                return this.removeCommandRoleSlash(interaction, target, role);
            } else {
                return this.removeCategoryRoleSlash(interaction, target, role);
            }
        }
    },
    
    // Helper methods for text commands
    async addCommandRole(message, commandName, role) {
        const result = permissionManager.addCommandRole(commandName, message.guild.id, role.id);
        
        if (result) {
            logger.info(`${message.author.tag} added role ${role.name} as required for command ${commandName} in ${message.guild.name}`);
            
            return message.reply({
                embeds: [createEmbed({
                    title: 'Role Requirement Added',
                    description: `The \`${role.name}\` role is now required to use the \`${commandName}\` command.`,
                    type: 'success'
                })]
            });
        } else {
            return message.reply({
                embeds: [createEmbed({
                    title: 'Role Already Required',
                    description: `The \`${role.name}\` role is already required for the \`${commandName}\` command.`,
                    type: 'info'
                })]
            });
        }
    },
    
    async removeCommandRole(message, commandName, role) {
        const result = permissionManager.removeCommandRole(commandName, message.guild.id, role.id);
        
        if (result) {
            logger.info(`${message.author.tag} removed role ${role.name} from requirements for command ${commandName} in ${message.guild.name}`);
            
            return message.reply({
                embeds: [createEmbed({
                    title: 'Role Requirement Removed',
                    description: `The \`${role.name}\` role is no longer required to use the \`${commandName}\` command.`,
                    type: 'success'
                })]
            });
        } else {
            return message.reply({
                embeds: [createEmbed({
                    title: 'Role Not Required',
                    description: `The \`${role.name}\` role was not required for the \`${commandName}\` command.`,
                    type: 'info'
                })]
            });
        }
    },
    
    async addCategoryRole(message, category, role) {
        const result = permissionManager.addCategoryRole(category, message.guild.id, role.id);
        
        if (result) {
            logger.info(`${message.author.tag} added role ${role.name} as required for category ${category} in ${message.guild.name}`);
            
            return message.reply({
                embeds: [createEmbed({
                    title: 'Role Requirement Added',
                    description: `The \`${role.name}\` role is now required to use commands in the \`${category}\` category.`,
                    type: 'success'
                })]
            });
        } else {
            return message.reply({
                embeds: [createEmbed({
                    title: 'Role Already Required',
                    description: `The \`${role.name}\` role is already required for the \`${category}\` category.`,
                    type: 'info'
                })]
            });
        }
    },
    
    async removeCategoryRole(message, category, role) {
        const result = permissionManager.removeCategoryRole(category, message.guild.id, role.id);
        
        if (result) {
            logger.info(`${message.author.tag} removed role ${role.name} from requirements for category ${category} in ${message.guild.name}`);
            
            return message.reply({
                embeds: [createEmbed({
                    title: 'Role Requirement Removed',
                    description: `The \`${role.name}\` role is no longer required to use commands in the \`${category}\` category.`,
                    type: 'success'
                })]
            });
        } else {
            return message.reply({
                embeds: [createEmbed({
                    title: 'Role Not Required',
                    description: `The \`${role.name}\` role was not required for the \`${category}\` category.`,
                    type: 'info'
                })]
            });
        }
    },
    
    async listCommandRequirements(message, commandName) {
        const roleIds = permissionManager.getCommandRoles(commandName, message.guild.id);
        
        if (roleIds.length === 0) {
            return message.reply({
                embeds: [createEmbed({
                    title: `Role Requirements for ${commandName}`,
                    description: `No specific roles are required to use the \`${commandName}\` command in this server.`,
                    type: 'info'
                })]
            });
        }
        
        const roleList = roleIds.map(id => {
            const role = message.guild.roles.cache.get(id);
            return role ? `• ${role.name} (${id})` : `• Unknown Role (${id})`;
        }).join('\n');
        
        return message.reply({
            embeds: [createEmbed({
                title: `Role Requirements for ${commandName}`,
                description: `The following roles can use the \`${commandName}\` command in this server:\n\n${roleList}`,
                type: 'info'
            })]
        });
    },
    
    async listCategoryRequirements(message, category) {
        const roleIds = permissionManager.getCategoryRoles(category, message.guild.id);
        
        if (roleIds.length === 0) {
            return message.reply({
                embeds: [createEmbed({
                    title: `Role Requirements for ${category}`,
                    description: `No specific roles are required to use commands in the \`${category}\` category in this server.`,
                    type: 'info'
                })]
            });
        }
        
        const roleList = roleIds.map(id => {
            const role = message.guild.roles.cache.get(id);
            return role ? `• ${role.name} (${id})` : `• Unknown Role (${id})`;
        }).join('\n');
        
        return message.reply({
            embeds: [createEmbed({
                title: `Role Requirements for ${category}`,
                description: `The following roles can use commands in the \`${category}\` category in this server:\n\n${roleList}`,
                type: 'info'
            })]
        });
    },
    
    async listAllRequirements(message) {
        const { commandRoles, categoryRoles } = permissionManager.permissionsData;
        
        let description = '';
        
        // Command-specific roles
        const guildCommandRoles = {};
        for (const [command, guilds] of Object.entries(commandRoles)) {
            if (guilds[message.guild.id]) {
                guildCommandRoles[command] = guilds[message.guild.id];
            }
        }
        
        if (Object.keys(guildCommandRoles).length > 0) {
            description += '**Command-Specific Roles:**\n';
            
            for (const [command, roleIds] of Object.entries(guildCommandRoles)) {
                const roleList = roleIds.map(id => {
                    const role = message.guild.roles.cache.get(id);
                    return role ? role.name : `Unknown Role (${id})`;
                }).join(', ');
                
                description += `• \`${command}\`: ${roleList}\n`;
            }
            
            description += '\n';
        }
        
        // Category-specific roles
        const guildCategoryRoles = {};
        for (const [category, guilds] of Object.entries(categoryRoles)) {
            if (guilds[message.guild.id]) {
                guildCategoryRoles[category] = guilds[message.guild.id];
            }
        }
        
        if (Object.keys(guildCategoryRoles).length > 0) {
            description += '**Category-Specific Roles:**\n';
            
            for (const [category, roleIds] of Object.entries(guildCategoryRoles)) {
                const roleList = roleIds.map(id => {
                    const role = message.guild.roles.cache.get(id);
                    return role ? role.name : `Unknown Role (${id})`;
                }).join(', ');
                
                description += `• \`${category}\`: ${roleList}\n`;
            }
        }
        
        if (!description) {
            description = 'No role requirements have been set up in this server.';
        }
        
        return message.reply({
            embeds: [createEmbed({
                title: 'Role Requirements',
                description,
                type: 'info'
            })]
        });
    },
    
    // Helper methods for slash commands
    async addCommandRoleSlash(interaction, commandName, role) {
        const result = permissionManager.addCommandRole(commandName, interaction.guild.id, role.id);
        
        if (result) {
            logger.info(`${interaction.user.tag} added role ${role.name} as required for command ${commandName} in ${interaction.guild.name}`);
            
            return interaction.reply({
                embeds: [createEmbed({
                    title: 'Role Requirement Added',
                    description: `The \`${role.name}\` role is now required to use the \`${commandName}\` command.`,
                    type: 'success'
                })]
            });
        } else {
            return interaction.reply({
                embeds: [createEmbed({
                    title: 'Role Already Required',
                    description: `The \`${role.name}\` role is already required for the \`${commandName}\` command.`,
                    type: 'info'
                })]
            });
        }
    },
    
    async removeCommandRoleSlash(interaction, commandName, role) {
        const result = permissionManager.removeCommandRole(commandName, interaction.guild.id, role.id);
        
        if (result) {
            logger.info(`${interaction.user.tag} removed role ${role.name} from requirements for command ${commandName} in ${interaction.guild.name}`);
            
            return interaction.reply({
                embeds: [createEmbed({
                    title: 'Role Requirement Removed',
                    description: `The \`${role.name}\` role is no longer required to use the \`${commandName}\` command.`,
                    type: 'success'
                })]
            });
        } else {
            return interaction.reply({
                embeds: [createEmbed({
                    title: 'Role Not Required',
                    description: `The \`${role.name}\` role was not required for the \`${commandName}\` command.`,
                    type: 'info'
                })]
            });
        }
    },
    
    async addCategoryRoleSlash(interaction, category, role) {
        const result = permissionManager.addCategoryRole(category, interaction.guild.id, role.id);
        
        if (result) {
            logger.info(`${interaction.user.tag} added role ${role.name} as required for category ${category} in ${interaction.guild.name}`);
            
            return interaction.reply({
                embeds: [createEmbed({
                    title: 'Role Requirement Added',
                    description: `The \`${role.name}\` role is now required to use commands in the \`${category}\` category.`,
                    type: 'success'
                })]
            });
        } else {
            return interaction.reply({
                embeds: [createEmbed({
                    title: 'Role Already Required',
                    description: `The \`${role.name}\` role is already required for the \`${category}\` category.`,
                    type: 'info'
                })]
            });
        }
    },
    
    async removeCategoryRoleSlash(interaction, category, role) {
        const result = permissionManager.removeCategoryRole(category, interaction.guild.id, role.id);
        
        if (result) {
            logger.info(`${interaction.user.tag} removed role ${role.name} from requirements for category ${category} in ${interaction.guild.name}`);
            
            return interaction.reply({
                embeds: [createEmbed({
                    title: 'Role Requirement Removed',
                    description: `The \`${role.name}\` role is no longer required to use commands in the \`${category}\` category.`,
                    type: 'success'
                })]
            });
        } else {
            return interaction.reply({
                embeds: [createEmbed({
                    title: 'Role Not Required',
                    description: `The \`${role.name}\` role was not required for the \`${category}\` category.`,
                    type: 'info'
                })]
            });
        }
    },
    
    async listCommandRequirementsSlash(interaction, commandName) {
        const roleIds = permissionManager.getCommandRoles(commandName, interaction.guild.id);
        
        if (roleIds.length === 0) {
            return interaction.reply({
                embeds: [createEmbed({
                    title: `Role Requirements for ${commandName}`,
                    description: `No specific roles are required to use the \`${commandName}\` command in this server.`,
                    type: 'info'
                })]
            });
        }
        
        const roleList = roleIds.map(id => {
            const role = interaction.guild.roles.cache.get(id);
            return role ? `• ${role.name} (${id})` : `• Unknown Role (${id})`;
        }).join('\n');
        
        return interaction.reply({
            embeds: [createEmbed({
                title: `Role Requirements for ${commandName}`,
                description: `The following roles can use the \`${commandName}\` command in this server:\n\n${roleList}`,
                type: 'info'
            })]
        });
    },
    
    async listCategoryRequirementsSlash(interaction, category) {
        const roleIds = permissionManager.getCategoryRoles(category, interaction.guild.id);
        
        if (roleIds.length === 0) {
            return interaction.reply({
                embeds: [createEmbed({
                    title: `Role Requirements for ${category}`,
                    description: `No specific roles are required to use commands in the \`${category}\` category in this server.`,
                    type: 'info'
                })]
            });
        }
        
        const roleList = roleIds.map(id => {
            const role = interaction.guild.roles.cache.get(id);
            return role ? `• ${role.name} (${id})` : `• Unknown Role (${id})`;
        }).join('\n');
        
        return interaction.reply({
            embeds: [createEmbed({
                title: `Role Requirements for ${category}`,
                description: `The following roles can use commands in the \`${category}\` category in this server:\n\n${roleList}`,
                type: 'info'
            })]
        });
    },
    
    async listAllRequirementsSlash(interaction) {
        const { commandRoles, categoryRoles } = permissionManager.permissionsData;
        
        let description = '';
        
        // Command-specific roles
        const guildCommandRoles = {};
        for (const [command, guilds] of Object.entries(commandRoles)) {
            if (guilds[interaction.guild.id]) {
                guildCommandRoles[command] = guilds[interaction.guild.id];
            }
        }
        
        if (Object.keys(guildCommandRoles).length > 0) {
            description += '**Command-Specific Roles:**\n';
            
            for (const [command, roleIds] of Object.entries(guildCommandRoles)) {
                const roleList = roleIds.map(id => {
                    const role = interaction.guild.roles.cache.get(id);
                    return role ? role.name : `Unknown Role (${id})`;
                }).join(', ');
                
                description += `• \`${command}\`: ${roleList}\n`;
            }
            
            description += '\n';
        }
        
        // Category-specific roles
        const guildCategoryRoles = {};
        for (const [category, guilds] of Object.entries(categoryRoles)) {
            if (guilds[interaction.guild.id]) {
                guildCategoryRoles[category] = guilds[interaction.guild.id];
            }
        }
        
        if (Object.keys(guildCategoryRoles).length > 0) {
            description += '**Category-Specific Roles:**\n';
            
            for (const [category, roleIds] of Object.entries(guildCategoryRoles)) {
                const roleList = roleIds.map(id => {
                    const role = interaction.guild.roles.cache.get(id);
                    return role ? role.name : `Unknown Role (${id})`;
                }).join(', ');
                
                description += `• \`${category}\`: ${roleList}\n`;
            }
        }
        
        if (!description) {
            description = 'No role requirements have been set up in this server.';
        }
        
        return interaction.reply({
            embeds: [createEmbed({
                title: 'Role Requirements',
                description,
                type: 'info'
            })]
        });
    }
};