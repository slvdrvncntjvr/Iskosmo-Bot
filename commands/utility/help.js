const { SlashCommandBuilder } = require('discord.js');
const config = require('../../config');
const { createEmbed } = require('../../utils/embedBuilder');
const cooldownManager = require('../../utils/cooldownManager');
const permissionManager = require('../../utils/permissionManager');
const logger = require('../../utils/logger');

module.exports = {
    name: 'help',
    description: 'Display available commands or info about a specific command',
    usage: '[command name]',
    category: 'utility',

    slashCommand: new SlashCommandBuilder()
        .setName('help')
        .setDescription('Display available commands or info about a specific command')
        .addStringOption(option => 
            option.setName('command')
                .setDescription('The specific command to get info about')
                .setRequired(false)),
    
    async execute(message, args, client) {
        const { commands } = client;
        const isOwner = permissionManager.isOwner(message.author.id);
        const isServerOwner = message.guild && message.author.id === message.guild.ownerId;
        const isAdmin = message.member && message.member.permissions.has('Administrator');
 
        if (!args.length) {
            const categories = {};
            commands.forEach(command => {
                // Filter commands based on permissions
                if (command.ownerOnly && !isOwner) {
                    return; // Skip owner-only commands
                }
                
                // Skip commands that require server owner if user isn't the owner
                if (command.serverOwnerOnly && !isServerOwner && !isOwner) {
                    return;
                }
                
                // Skip admin commands if user isn't an admin
                if (command.adminOnly && !isAdmin && !isServerOwner && !isOwner) {
                    return;
                }
                
                // Check role requirements (with error handling)
                if (message.guild && command.name) {
                    try {
                        if (!this.hasRequiredRole(message, command.name)) {
                            return;
                        }
                    } catch (error) {
                        // Log error but don't fail completely
                        logger.error('Error checking role requirements:', error);
                    }
                }
                
                const category = command.category || 'Uncategorized';
                
                if (!categories[category]) {
                    categories[category] = [];
                }
                
                categories[category].push(command);
            });
            
            const helpEmbed = createEmbed({
                title: 'Command Help',
                description: `Use \`${config.prefix}help [command name]\` to get info on a specific command.`,
                type: 'info'
            });

            const maxFieldLength = 1024;
            for (const [category, cmds] of Object.entries(categories)) {
                // Skip empty categories (might happen if all commands were hidden)
                if (cmds.length === 0) continue;
                
                const categoryName = `📁 ${category.charAt(0).toUpperCase() + category.slice(1)}`;
                let commandList = cmds.map(cmd => `\`${cmd.name}\`: ${cmd.description}`).join('\n');
                
                // If the command list is too long, split it into multiple fields
                if (commandList.length > maxFieldLength) {
                    const commands = cmds.map(cmd => `\`${cmd.name}\`: ${cmd.description}`);
                    let currentField = '';
                    let fieldIndex = 1;
                    
                    for (const command of commands) {
                        if ((currentField + '\n' + command).length > maxFieldLength) {
                            helpEmbed.addFields({
                                name: fieldIndex === 1 ? categoryName : `${categoryName} (continued)`,
                                value: currentField || 'No commands available'
                            });
                            currentField = command;
                            fieldIndex++;
                        } else {
                            currentField = currentField ? currentField + '\n' + command : command;
                        }
                    }
                    
                    // Add the remaining commands
                    if (currentField) {
                        helpEmbed.addFields({
                            name: fieldIndex === 1 ? categoryName : `${categoryName} (continued)`,
                            value: currentField
                        });
                    }
                } else {
                    helpEmbed.addFields({
                        name: categoryName,
                        value: commandList || 'No commands available'
                    });
                }
            }

            // Ensure the embed doesn't exceed Discord's limits
            if (helpEmbed.data.fields && helpEmbed.data.fields.length > 25) {
                // Discord has a 25 field limit, so we need to truncate
                helpEmbed.data.fields = helpEmbed.data.fields.slice(0, 24);
                helpEmbed.addFields({
                    name: '⚠️ Note',
                    value: 'Some commands were hidden due to Discord embed limits. Use `!help [command]` for specific commands.'
                });
            }
            
            try {
                return message.reply({ embeds: [helpEmbed] });
            } catch (error) {
                logger.error('Error sending help embed:', error);
                return message.reply('❌ Error displaying help. The command list might be too large. Try `!help [specific command]` instead.');
            }
        }
        
        const commandName = args[0].toLowerCase();
        const command = commands.get(commandName);
        
        if (!command) {
            return message.reply({ 
                embeds: [createEmbed({
                    title: 'Command Not Found',
                    description: `Could not find command \`${commandName}\`.`,
                    type: 'error'
                })]
            });
        }
        
        // Check if user has permission to see this command (with error handling)
        try {
            if ((command.ownerOnly && !isOwner) || 
                (command.serverOwnerOnly && !isServerOwner && !isOwner) ||
                (command.adminOnly && !isAdmin && !isServerOwner && !isOwner) ||
                (message.guild && !this.hasRequiredRole(message, command.name))) {
                return message.reply({ 
                    embeds: [createEmbed({
                        title: 'Permission Denied',
                        description: `You don't have permission to use the \`${commandName}\` command.`,
                        type: 'error'
                    })]
                });
            }
        } catch (error) {
            // If there's an error checking permissions, just show the command
            logger.error('Error checking command permissions:', error);
        }
        
        const commandEmbed = createEmbed({
            title: `Command: ${command.name}`,
            description: command.description,
            type: 'info'
        });
        
        if (command.aliases) {
            commandEmbed.addFields({ name: 'Aliases', value: command.aliases.join(', ') });
        }
        
        if (command.usage) {
            commandEmbed.addFields({ name: 'Usage', value: `${config.prefix}${command.name} ${command.usage}` });
        }
        
        try {
            message.reply({ embeds: [commandEmbed] });
        } catch (error) {
            logger.error('Error sending command help embed:', error);
            message.reply(`❌ Error displaying help for \`${command.name}\`. Please try again later.`);
        }
    },
    
    async executeSlash(interaction, client) {
        const commandName = interaction.options.getString('command');
        const { commands } = client;
        const isOwner = permissionManager.isOwner(interaction.user.id);
        const isServerOwner = interaction.guild && interaction.user.id === interaction.guild.ownerId;
        const isAdmin = interaction.member && interaction.member.permissions.has('Administrator');

        if (!commandName) {
            const categories = {};
            
            commands.forEach(command => {
                // Filter commands based on permissions
                if (command.ownerOnly && !isOwner) {
                    return; // Skip owner-only commands
                }
                
                // Skip commands that require server owner if user isn't the owner
                if (command.serverOwnerOnly && !isServerOwner && !isOwner) {
                    return;
                }
                
                // Skip admin commands if user isn't an admin
                if (command.adminOnly && !isAdmin && !isServerOwner && !isOwner) {
                    return;
                }
                
                // Check role requirements (with error handling)
                if (interaction.guild && command.name) {
                    try {
                        if (!this.hasRequiredRoleSlash(interaction, command.name)) {
                            return;
                        }
                    } catch (error) {
                        // Log error but don't fail completely
                        logger.error('Error checking role requirements:', error);
                    }
                }
                
                const category = command.category || 'Uncategorized';
                
                if (!categories[category]) {
                    categories[category] = [];
                }
                
                categories[category].push(command);
            });
            
            const helpEmbed = createEmbed({
                title: 'Command Help',
                description: `Use \`/help command:[command name]\` to get info on a specific command.`,
                type: 'info'
            });

            const maxFieldLength = 1024;
            for (const [category, cmds] of Object.entries(categories)) {
                // Skip empty categories (might happen if all commands were hidden)
                if (cmds.length === 0) continue;
                
                const categoryName = `📁 ${category.charAt(0).toUpperCase() + category.slice(1)}`;
                let commandList = cmds.map(cmd => `\`${cmd.name}\`: ${cmd.description}`).join('\n');
                
                // If the command list is too long, split it into multiple fields
                if (commandList.length > maxFieldLength) {
                    const commands = cmds.map(cmd => `\`${cmd.name}\`: ${cmd.description}`);
                    let currentField = '';
                    let fieldIndex = 1;
                    
                    for (const command of commands) {
                        if ((currentField + '\n' + command).length > maxFieldLength) {
                            helpEmbed.addFields({
                                name: fieldIndex === 1 ? categoryName : `${categoryName} (continued)`,
                                value: currentField || 'No commands available'
                            });
                            currentField = command;
                            fieldIndex++;
                        } else {
                            currentField = currentField ? currentField + '\n' + command : command;
                        }
                    }
                    
                    // Add the remaining commands
                    if (currentField) {
                        helpEmbed.addFields({
                            name: fieldIndex === 1 ? categoryName : `${categoryName} (continued)`,
                            value: currentField
                        });
                    }
                } else {
                    helpEmbed.addFields({
                        name: categoryName,
                        value: commandList || 'No commands available'
                    });
                }
            }

            // Ensure the embed doesn't exceed Discord's limits
            if (helpEmbed.data.fields && helpEmbed.data.fields.length > 25) {
                // Discord has a 25 field limit, so we need to truncate
                helpEmbed.data.fields = helpEmbed.data.fields.slice(0, 24);
                helpEmbed.addFields({
                    name: '⚠️ Note',
                    value: 'Some commands were hidden due to Discord embed limits. Use `/help command:[name]` for specific commands.'
                });
            }
            
            try {
                return interaction.reply({ embeds: [helpEmbed] });
            } catch (error) {
                logger.error('Error sending help embed:', error);
                return interaction.reply({ 
                    content: '❌ Error displaying help. The command list might be too large. Try `/help command:[specific command]` instead.',
                    ephemeral: true 
                });
            }
        }
        
        const command = commands.get(commandName.toLowerCase());
        
        if (!command) {
            return interaction.reply({ 
                embeds: [createEmbed({
                    title: 'Command Not Found',
                    description: `Could not find command \`${commandName}\`.`,
                    type: 'error'
                })],
                ephemeral: true
            });
        }
        
        // Check if user has permission to see this command (with error handling)
        try {
            if ((command.ownerOnly && !isOwner) || 
                (command.serverOwnerOnly && !isServerOwner && !isOwner) ||
                (command.adminOnly && !isAdmin && !isServerOwner && !isOwner) ||
                (interaction.guild && !this.hasRequiredRoleSlash(interaction, command.name))) {
                return interaction.reply({ 
                    embeds: [createEmbed({
                        title: 'Command Not Found',
                        description: `Could not find command \`${commandName}\`.`,
                        type: 'error'
                    })],
                    ephemeral: true
                });
            }
        } catch (error) {
            // If there's an error checking permissions, just show the command
            logger.error('Error checking command permissions:', error);
        }
        
        const commandEmbed = createEmbed({
            title: `Command: ${command.name}`,
            description: command.description,
            type: 'info'
        });
        
        if (command.aliases) {
            commandEmbed.addFields({ name: 'Aliases', value: command.aliases.join(', ') });
        }
        
        if (command.usage) {
            commandEmbed.addFields({ name: 'Usage', value: `${config.prefix}${command.name} ${command.usage}` });
        }
        
        try {
            interaction.reply({ embeds: [commandEmbed] });
        } catch (error) {
            logger.error('Error sending command help embed:', error);
            interaction.reply({ 
                content: `❌ Error displaying help for \`${command.name}\`. Please try again later.`,
                ephemeral: true 
            });
        }
    },
    
    // Helper method to check if a user has a required role for a command
    hasRequiredRole(message, commandName) {
        try {
            // Bot owners bypass role checks
            if (permissionManager.isOwner(message.author.id)) {
                return true;
            }
            
            // If not in a guild or no member, consider no role requirements
            if (!message.guild || !message.member) {
                return true;
            }
            
            // Get user's roles
            const memberRoles = message.member.roles.cache.map(role => role.id);
            
            // Use the existing isAuthorized method with role information
            return permissionManager.isAuthorized(message.author.id, commandName, message.guild.id, memberRoles);
        } catch (error) {
            logger.error('Error in hasRequiredRole:', error);
            return true; // Default to allowing access if there's an error
        }
    },
    
    // Helper method for slash commands
    hasRequiredRoleSlash(interaction, commandName) {
        try {
            // Bot owners bypass role checks
            if (permissionManager.isOwner(interaction.user.id)) {
                return true;
            }
            
            // If not in a guild or no member, consider no role requirements
            if (!interaction.guild || !interaction.member) {
                return true;
            }
            
            // Get user's roles
            const memberRoles = interaction.member.roles.cache.map(role => role.id);
            
            // Use the existing isAuthorized method with role information
            return permissionManager.isAuthorized(interaction.user.id, commandName, interaction.guild.id, memberRoles);
        } catch (error) {
            logger.error('Error in hasRequiredRoleSlash:', error);
            return true; // Default to allowing access if there's an error
        }
    }
};