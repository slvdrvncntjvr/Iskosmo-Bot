const { SlashCommandBuilder } = require('discord.js');
const { createEmbed } = require('../../utils/embedBuilder');
const permissionManager = require('../../utils/permissionManager');
const logger = require('../../utils/logger');

module.exports = {
    name: 'auth',
    description: 'Manage authorized users for commands',
    usage: '<add/remove/list> <command> [user mention or ID] or <owner_add/owner_remove/owner_list> [user mention or ID]',
    category: 'utility',
    
    slashCommand: new SlashCommandBuilder()
        .setName('auth')
        .setDescription('Manage authorized users for commands')
        .addSubcommand(subcommand =>
            subcommand
                .setName('add')
                .setDescription('Add a user to authorized users for a command')
                .addStringOption(option =>
                    option.setName('command')
                        .setDescription('The command name')
                        .setRequired(true))
                .addUserOption(option =>
                    option.setName('user')
                        .setDescription('The user to authorize')
                        .setRequired(true)))
        .addSubcommand(subcommand =>
            subcommand
                .setName('remove')
                .setDescription('Remove a user from authorized users for a command')
                .addStringOption(option =>
                    option.setName('command')
                        .setDescription('The command name')
                        .setRequired(true))
                .addUserOption(option =>
                    option.setName('user')
                        .setDescription('The user to remove authorization from')
                        .setRequired(true)))
        .addSubcommand(subcommand =>
            subcommand
                .setName('list')
                .setDescription('List authorized users for a command')
                .addStringOption(option =>
                    option.setName('command')
                        .setDescription('The command name')
                        .setRequired(true)))
        .addSubcommand(subcommand =>
            subcommand
                .setName('owner_add')
                .setDescription('Add a bot owner')
                .addUserOption(option =>
                    option.setName('user')
                        .setDescription('The user to add as owner')
                        .setRequired(true)))
        .addSubcommand(subcommand =>
            subcommand
                .setName('owner_remove')
                .setDescription('Remove a bot owner')
                .addUserOption(option =>
                    option.setName('user')
                        .setDescription('The user to remove as owner')
                        .setRequired(true)))
        .addSubcommand(subcommand =>
            subcommand
                .setName('owner_list')
                .setDescription('List all bot owners')),
    
    async execute(message, args, client) {
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

        if (action === 'owner_add' || action === 'owner') {
            if (action === 'owner' && args.length < 2) {
                return message.reply({
                    embeds: [createEmbed({
                        title: 'Error',
                        description: 'Please specify add/remove/list for owner management.',
                        type: 'error'
                    })]
                });
            }
            
            // Handle legacy 'owner add' command format
            let userIndex = 1;
            if (action === 'owner') {
                const subaction = args[1].toLowerCase();
                if (subaction === 'list') {
                    return this.listOwners(message);
                } else if (subaction === 'add') {
                    userIndex = 2;
                } else if (subaction === 'remove') {
                    userIndex = 2;
                } else {
                    return message.reply({
                        embeds: [createEmbed({
                            title: 'Error',
                            description: 'Please specify add/remove/list for owner management.',
                            type: 'error'
                        })]
                    });
                }
            }
            
            const user = message.mentions.users.first() || client.users.cache.get(args[userIndex]);
            
            if (!user) {
                return message.reply({
                    embeds: [createEmbed({
                        title: 'Error',
                        description: 'Please mention a user or provide a valid user ID.',
                        type: 'error'
                    })]
                });
            }
            
            if (action === 'owner_add' || (action === 'owner' && args[1].toLowerCase() === 'add')) {
                return this.addOwner(message, user);
            } else {
                return this.removeOwner(message, user);
            }
        } else if (action === 'owner_remove') {
            const user = message.mentions.users.first() || client.users.cache.get(args[1]);
            
            if (!user) {
                return message.reply({
                    embeds: [createEmbed({
                        title: 'Error',
                        description: 'Please mention a user or provide a valid user ID.',
                        type: 'error'
                    })]
                });
            }
            
            return this.removeOwner(message, user);
        } else if (action === 'owner_list') {
            return this.listOwners(message);
        }

        if (!['add', 'remove', 'list'].includes(action)) {
            return message.reply({
                embeds: [createEmbed({
                    title: 'Error',
                    description: 'Please specify `add`, `remove`, or `list` as the action.',
                    type: 'error'
                })]
            });
        }

        if (args.length < 2) {
            return message.reply({
                embeds: [createEmbed({
                    title: 'Error',
                    description: 'Please specify a command name.',
                    type: 'error'
                })]
            });
        }
        
        const commandName = args[1].toLowerCase();

        if (!client.commands.has(commandName)) {
            return message.reply({
                embeds: [createEmbed({
                    title: 'Error',
                    description: `Command \`${commandName}\` does not exist.`,
                    type: 'error'
                })]
            });
        }
        
        if (action === 'list') {
            return this.listUsers(message, commandName);
        }

        const user = message.mentions.users.first() || client.users.cache.get(args[2]);
        
        if (!user) {
            return message.reply({
                embeds: [createEmbed({
                    title: 'Error',
                    description: 'Please mention a user or provide a valid user ID.',
                    type: 'error'
                })]
            });
        }
        
        if (action === 'add') {
            return this.addUser(message, commandName, user);
        } else if (action === 'remove') {
            return this.removeUser(message, commandName, user);
        }
    },
    
    async executeSlash(interaction, client) {
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

        // Handle owner subcommands
        if (subcommand === 'owner_list') {
            return this.listOwnersSlash(interaction);
        } else if (subcommand === 'owner_add') {
            const user = interaction.options.getUser('user');
            return this.addOwnerSlash(interaction, user);
        } else if (subcommand === 'owner_remove') {
            const user = interaction.options.getUser('user');
            return this.removeOwnerSlash(interaction, user);
        }

        // Handle regular auth subcommands
        const commandName = interaction.options.getString('command').toLowerCase();

        if (!client.commands.has(commandName)) {
            return interaction.reply({
                embeds: [createEmbed({
                    title: 'Error',
                    description: `Command \`${commandName}\` does not exist.`,
                    type: 'error'
                })],
                ephemeral: true
            });
        }
        
        if (subcommand === 'list') {
            return this.listUsersSlash(interaction, commandName);
        }
        
        const user = interaction.options.getUser('user');
        
        if (subcommand === 'add') {
            return this.addUserSlash(interaction, commandName, user);
        } else if (subcommand === 'remove') {
            return this.removeUserSlash(interaction, commandName, user);
        }
    },
    
    async addUser(message, commandName, user) {
        const result = permissionManager.addAuthorizedUser(commandName, user.id);
        
        if (result) {
            logger.info(`${message.author.tag} added ${user.tag} as authorized user for ${commandName}`);
            
            return message.reply({
                embeds: [createEmbed({
                    title: 'Authorization Added',
                    description: `${user.tag} has been authorized to use the \`${commandName}\` command.`,
                    type: 'success'
                })]
            });
        } else {
            return message.reply({
                embeds: [createEmbed({
                    title: 'Already Authorized',
                    description: `${user.tag} is already authorized to use the \`${commandName}\` command.`,
                    type: 'info'
                })]
            });
        }
    },
    
    async removeUser(message, commandName, user) {
        const result = permissionManager.removeAuthorizedUser(commandName, user.id);
        
        if (result) {
            logger.info(`${message.author.tag} removed ${user.tag} as authorized user for ${commandName}`);
            
            return message.reply({
                embeds: [createEmbed({
                    title: 'Authorization Removed',
                    description: `${user.tag} is no longer authorized to use the \`${commandName}\` command.`,
                    type: 'success'
                })]
            });
        } else {
            return message.reply({
                embeds: [createEmbed({
                    title: 'Not Authorized',
                    description: `${user.tag} was not authorized to use the \`${commandName}\` command.`,
                    type: 'info'
                })]
            });
        }
    },
    
    async listUsers(message, commandName) {
        const users = permissionManager.getAuthorizedUsers(commandName);
        
        if (users.length === 0) {
            return message.reply({
                embeds: [createEmbed({
                    title: `Authorized Users for ${commandName}`,
                    description: 'No users are specifically authorized for this command. Only bot owners can use it.',
                    type: 'info'
                })]
            });
        }
        
        // Try to fetch user tags
        let userList = '';
        for (const userId of users) {
            try {
                const user = await message.client.users.fetch(userId);
                userList += `• ${user.tag} (${userId})\n`;
            } catch {
                userList += `• Unknown User (${userId})\n`;
            }
        }
        
        return message.reply({
            embeds: [createEmbed({
                title: `Authorized Users for ${commandName}`,
                description: userList,
                type: 'info'
            })]
        });
    },
    
    async addOwner(message, user) {
        const result = permissionManager.addOwner(user.id);
        
        if (result) {
            logger.info(`${message.author.tag} added ${user.tag} as bot owner`);
            
            return message.reply({
                embeds: [createEmbed({
                    title: 'Owner Added',
                    description: `${user.tag} has been added as a bot owner.`,
                    type: 'success'
                })]
            });
        } else {
            return message.reply({
                embeds: [createEmbed({
                    title: 'Already Owner',
                    description: `${user.tag} is already a bot owner.`,
                    type: 'info'
                })]
            });
        }
    },
    
    async removeOwner(message, user) {
        const result = permissionManager.removeOwner(user.id);
        
        if (result) {
            logger.info(`${message.author.tag} removed ${user.tag} as bot owner`);
            
            return message.reply({
                embeds: [createEmbed({
                    title: 'Owner Removed',
                    description: `${user.tag} is no longer a bot owner.`,
                    type: 'success'
                })]
            });
        } else {
            return message.reply({
                embeds: [createEmbed({
                    title: 'Not Owner',
                    description: `${user.tag} was not a bot owner.`,
                    type: 'info'
                })]
            });
        }
    },
    
    async listOwners(message) {
        const owners = permissionManager.getOwners();
        
        if (owners.length === 0) {
            return message.reply({
                embeds: [createEmbed({
                    title: 'Bot Owners',
                    description: 'No bot owners are configured. This is unusual and may indicate a configuration issue.',
                    type: 'warning'
                })]
            });
        }

        let ownerList = '';
        for (const ownerId of owners) {
            try {
                const owner = await message.client.users.fetch(ownerId);
                ownerList += `• ${owner.tag} (${ownerId})\n`;
            } catch {
                ownerList += `• Unknown User (${ownerId})\n`;
            }
        }
        
        return message.reply({
            embeds: [createEmbed({
                title: 'Bot Owners',
                description: ownerList,
                type: 'info'
            })]
        });
    },

    async addUserSlash(interaction, commandName, user) {
        const result = permissionManager.addAuthorizedUser(commandName, user.id);
        
        if (result) {
            logger.info(`${interaction.user.tag} added ${user.tag} as authorized user for ${commandName}`);
            
            return interaction.reply({
                embeds: [createEmbed({
                    title: 'Authorization Added',
                    description: `${user.tag} has been authorized to use the \`${commandName}\` command.`,
                    type: 'success'
                })]
            });
        } else {
            return interaction.reply({
                embeds: [createEmbed({
                    title: 'Already Authorized',
                    description: `${user.tag} is already authorized to use the \`${commandName}\` command.`,
                    type: 'info'
                })]
            });
        }
    },
    
    async removeUserSlash(interaction, commandName, user) {
        const result = permissionManager.removeAuthorizedUser(commandName, user.id);
        
        if (result) {
            logger.info(`${interaction.user.tag} removed ${user.tag} as authorized user for ${commandName}`);
            
            return interaction.reply({
                embeds: [createEmbed({
                    title: 'Authorization Removed',
                    description: `${user.tag} is no longer authorized to use the \`${commandName}\` command.`,
                    type: 'success'
                })]
            });
        } else {
            return interaction.reply({
                embeds: [createEmbed({
                    title: 'Not Authorized',
                    description: `${user.tag} was not authorized to use the \`${commandName}\` command.`,
                    type: 'info'
                })]
            });
        }
    },
    
    async listUsersSlash(interaction, commandName) {
        const users = permissionManager.getAuthorizedUsers(commandName);
        
        if (users.length === 0) {
            return interaction.reply({
                embeds: [createEmbed({
                    title: `Authorized Users for ${commandName}`,
                    description: 'No users are specifically authorized for this command. Only bot owners can use it.',
                    type: 'info'
                })]
            });
        }

        let userList = '';
        for (const userId of users) {
            try {
                const user = await interaction.client.users.fetch(userId);
                userList += `• ${user.tag} (${userId})\n`;
            } catch {
                userList += `• Unknown User (${userId})\n`;
            }
        }
        
        return interaction.reply({
            embeds: [createEmbed({
                title: `Authorized Users for ${commandName}`,
                description: userList,
                type: 'info'
            })]
        });
    },
    
    async addOwnerSlash(interaction, user) {
        const result = permissionManager.addOwner(user.id);
        
        if (result) {
            logger.info(`${interaction.user.tag} added ${user.tag} as bot owner`);
            
            return interaction.reply({
                embeds: [createEmbed({
                    title: 'Owner Added',
                    description: `${user.tag} has been added as a bot owner.`,
                    type: 'success'
                })]
            });
        } else {
            return interaction.reply({
                embeds: [createEmbed({
                    title: 'Already Owner',
                    description: `${user.tag} is already a bot owner.`,
                    type: 'info'
                })]
            });
        }
    },
    
    async removeOwnerSlash(interaction, user) {
        const result = permissionManager.removeOwner(user.id);
        
        if (result) {
            logger.info(`${interaction.user.tag} removed ${user.tag} as bot owner`);
            
            return interaction.reply({
                embeds: [createEmbed({
                    title: 'Owner Removed',
                    description: `${user.tag} is no longer a bot owner.`,
                    type: 'success'
                })]
            });
        } else {
            return interaction.reply({
                embeds: [createEmbed({
                    title: 'Not Owner',
                    description: `${user.tag} was not a bot owner.`,
                    type: 'info'
                })]
            });
        }
    },
    
    async listOwnersSlash(interaction) {
        const owners = permissionManager.getOwners();
        
        if (owners.length === 0) {
            return interaction.reply({
                embeds: [createEmbed({
                    title: 'Bot Owners',
                    description: 'No bot owners are configured. This is unusual and may indicate a configuration issue.',
                    type: 'warning'
                })]
            });
        }

        let ownerList = '';
        for (const ownerId of owners) {
            try {
                const owner = await interaction.client.users.fetch(ownerId);
                ownerList += `• ${owner.tag} (${ownerId})\n`;
            } catch {
                ownerList += `• Unknown User (${ownerId})\n`;
            }
        }
        
        return interaction.reply({
            embeds: [createEmbed({
                title: 'Bot Owners',
                description: ownerList,
                type: 'info'
            })]
        });
    }
};