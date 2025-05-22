const { SlashCommandBuilder, Collection } = require('discord.js');
const { createEmbed } = require('../../utils/embedBuilder');
const permissionManager = require('../../utils/permissionManager');
const logger = require('../../utils/logger');

module.exports = {
    name: 'remoteexec',
    description: 'Execute commands remotely in other servers (owner only)',
    usage: '<server_id> [channel_id] <command> [arguments...]',
    category: 'utility',
    ownerOnly: true,
    
    slashCommand: new SlashCommandBuilder()
        .setName('remoteexec')
        .setDescription('Execute commands remotely in other servers (owner only)')
        .addStringOption(option =>
            option.setName('server_id')
                .setDescription('The ID of the server to execute the command in')
                .setRequired(true))
        .addStringOption(option =>
            option.setName('command')
                .setDescription('The command to execute (without prefix)')
                .setRequired(true))
        .addStringOption(option =>
            option.setName('channel_id')
                .setDescription('The ID of the channel to execute the command in (optional)')
                .setRequired(false))
        .addStringOption(option =>
            option.setName('arguments')
                .setDescription('The arguments to pass to the command')
                .setRequired(false)),
    
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

        if (args.length < 2) {
            return message.reply({
                embeds: [createEmbed({
                    title: 'Error',
                    description: `Usage: \`!${this.name} ${this.usage}\``,
                    type: 'error'
                })]
            });
        }
        
        const serverId = args[0];
        let channelId = null;
        let commandName;
        let commandArgs;
        
        // Check if the second argument is a channel ID (18-digit number)
        if (args.length > 2 && /^\d{17,19}$/.test(args[1])) {
            channelId = args[1];
            commandName = args[2].toLowerCase();
            commandArgs = args.slice(3);
        } else {
            commandName = args[1].toLowerCase();
            commandArgs = args.slice(2);
        }
        
        return this.executeRemoteCommand(message, client, serverId, channelId, commandName, commandArgs);
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
        
        const serverId = interaction.options.getString('server_id');
        const channelId = interaction.options.getString('channel_id');
        const commandName = interaction.options.getString('command').toLowerCase();
        const argsString = interaction.options.getString('arguments') || '';
        const commandArgs = argsString.split(' ').filter(arg => arg.length > 0);
        
        await interaction.deferReply();
        return this.executeRemoteCommandSlash(interaction, client, serverId, channelId, commandName, commandArgs);
    },
    
    async executeRemoteCommand(message, client, serverId, channelId, commandName, commandArgs) {
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
        
        const command = client.commands.get(commandName);
        
        if (!command) {
            return message.reply({
                embeds: [createEmbed({
                    title: 'Error',
                    description: `Command \`${commandName}\` does not exist.`,
                    type: 'error'
                })]
            });
        }
        
        // Find target channel - either specified or a default one
        let targetChannel;
        
        if (channelId) {
            targetChannel = guild.channels.cache.get(channelId);
            
            if (!targetChannel) {
                return message.reply({
                    embeds: [createEmbed({
                        title: 'Error',
                        description: `Could not find a channel with ID \`${channelId}\` in server **${guild.name}**.`,
                        type: 'error'
                    })]
                });
            }
            
            // Check if the bot has permissions in the specified channel
            if (!targetChannel.permissionsFor(guild.members.me).has(['SendMessages', 'ViewChannel'])) {
                return message.reply({
                    embeds: [createEmbed({
                        title: 'Error',
                        description: `I don't have permission to send messages in the specified channel in server **${guild.name}**.`,
                        type: 'error'
                    })]
                });
            }
        } else {
            // Find the first accessible text channel if none specified
            targetChannel = guild.channels.cache.filter(c => 
                c.type === 0 && // 0 is GUILD_TEXT
                c.permissionsFor(guild.members.me).has(['SendMessages', 'ViewChannel'])
            ).first();
            
            if (!targetChannel) {
                return message.reply({
                    embeds: [createEmbed({
                        title: 'Error',
                        description: `Could not find an accessible text channel in server **${guild.name}**.`,
                        type: 'error'
                    })]
                });
            }
        }
        
        try {
            // Use the channel name in the log so we can see which channel was used
            logger.info(`Command executed by bot: ${commandName} in #${targetChannel.name} (${guild.name}, ${serverId})`);
            
            // Track the result of the command execution
            let result = null;
            
            // Create a special reply function that captures the result
            const captureReply = async (replyData) => {
                result = replyData; // Store the reply data
                return { id: 'remote-exec-response' }; // Return a mock message to prevent errors
            };
            
            // Create a mock message for the command to use - using bot's identity instead of user's
            const mockMessage = {
                content: `!${commandName} ${commandArgs.join(' ')}`,
                // Use the bot's user object instead of the message author
                author: client.user,
                guild: guild,
                channel: targetChannel,
                // Use the bot's member object in the guild instead of the user's
                member: guild.members.me,
                reply: captureReply,
                deletable: false,
                // Add a special flag to identify this as a remote execution
                isRemoteExecution: true,
                // Store the real executor for internal tracking only
                realExecutor: {
                    id: message.author.id,
                    tag: message.author.tag
                },
                // Add mentions property with Discord.js Collections instead of Maps
                mentions: {
                    members: new Collection(),
                    users: new Collection(),
                    roles: new Collection(),
                    channels: new Collection(),
                    everyone: false
                }
            };
            
            // Process mentions in the command arguments
            for (const arg of commandArgs) {
                // Check for user/member mentions like @user
                const userMentionMatch = arg.match(/<@!?(\d+)>/);
                if (userMentionMatch) {
                    const userId = userMentionMatch[1];
                    try {
                        const user = await client.users.fetch(userId);
                        if (user) {
                            mockMessage.mentions.users.set(user.id, user);
                            
                            const member = await guild.members.fetch(userId).catch(() => null);
                            if (member) {
                                mockMessage.mentions.members.set(member.id, member);
                            }
                        }
                    } catch (error) {
                        logger.warn(`Could not resolve user mention ${userId} in remote execution`);
                    }
                    continue;
                }
                
                // Check for direct user IDs (for commands like ban, kick that accept IDs)
                if (/^\d{17,19}$/.test(arg)) {
                    // This looks like a user ID (17-19 digits)
                    const userId = arg;
                    try {
                        const user = await client.users.fetch(userId);
                        if (user) {
                            mockMessage.mentions.users.set(user.id, user);
                            
                            const member = await guild.members.fetch(userId).catch(() => null);
                            if (member) {
                                mockMessage.mentions.members.set(member.id, member);
                            }
                        }
                    } catch (error) {
                        logger.warn(`Could not resolve user ID ${userId} in remote execution`);
                    }
                    continue;
                }
                
                // Check for role mentions
                const roleMentionMatch = arg.match(/<@&(\d+)>/);
                if (roleMentionMatch) {
                    const roleId = roleMentionMatch[1];
                    const role = guild.roles.cache.get(roleId);
                    if (role) {
                        mockMessage.mentions.roles.set(role.id, role);
                    }
                    continue;
                }
                
                // Check for channel mentions
                const channelMentionMatch = arg.match(/<#(\d+)>/);
                if (channelMentionMatch) {
                    const channelId = channelMentionMatch[1];
                    const channel = guild.channels.cache.get(channelId);
                    if (channel) {
                        mockMessage.mentions.channels.set(channel.id, channel);
                    }
                }
            }
            
            // Execute the command in the remote guild context with the bot's identity
            await command.execute(mockMessage, commandArgs, client);
            
            // If we have a result, forward it to the original message
            if (result) {
                message.reply({
                    embeds: [createEmbed({
                        title: `Remote Execution Result (${guild.name})`,
                        description: `Command \`${commandName}\` executed remotely.`,
                        type: 'success',
                        footer: { text: `Server ID: ${serverId}` }
                    })]
                });
                
                // If there are embeds, send those separately
                if (result.embeds && result.embeds.length > 0) {
                    await message.channel.send({ embeds: result.embeds });
                }
                
                // If there's content, send that too
                if (result.content) {
                    await message.channel.send({ content: result.content });
                }
            } else {
                message.reply({
                    embeds: [createEmbed({
                        title: `Remote Execution (${guild.name})`,
                        description: `Command \`${commandName}\` executed remotely, but no direct response was captured.`,
                        type: 'info',
                        footer: { text: `Server ID: ${serverId}` }
                    })]
                });
            }
        } catch (error) {
            // Changed log message to maintain bot execution appearance
            logger.error(`Error executing command ${commandName} in ${serverId}:`, error);
            
            return message.reply({
                embeds: [createEmbed({
                    title: 'Command Error',
                    description: `Failed to execute command remotely: ${error.message}`,
                    type: 'error'
                })]
            });
        }
    },
    
    async executeRemoteCommandSlash(interaction, client, serverId, channelId, commandName, commandArgs) {
        const guild = client.guilds.cache.get(serverId);
        
        if (!guild) {
            return interaction.editReply({
                embeds: [createEmbed({
                    title: 'Error',
                    description: `Could not find a server with ID \`${serverId}\`.`,
                    type: 'error'
                })]
            });
        }
        
        const command = client.commands.get(commandName);
        
        if (!command) {
            return interaction.editReply({
                embeds: [createEmbed({
                    title: 'Error',
                    description: `Command \`${commandName}\` does not exist.`,
                    type: 'error'
                })]
            });
        }
        
        // Find target channel - either specified or a default one
        let targetChannel;
        
        if (channelId) {
            targetChannel = guild.channels.cache.get(channelId);
            
            if (!targetChannel) {
                return interaction.editReply({
                    embeds: [createEmbed({
                        title: 'Error',
                        description: `Could not find a channel with ID \`${channelId}\` in server **${guild.name}**.`,
                        type: 'error'
                    })]
                });
            }
            
            // Check if the bot has permissions in the specified channel
            if (!targetChannel.permissionsFor(guild.members.me).has(['SendMessages', 'ViewChannel'])) {
                return interaction.editReply({
                    embeds: [createEmbed({
                        title: 'Error',
                        description: `I don't have permission to send messages in the specified channel in server **${guild.name}**.`,
                        type: 'error'
                    })]
                });
            }
        } else {
            // Find the first accessible text channel if none specified
            targetChannel = guild.channels.cache.filter(c => 
                c.type === 0 && // 0 is GUILD_TEXT
                c.permissionsFor(guild.members.me).has(['SendMessages', 'ViewChannel'])
            ).first();
            
            if (!targetChannel) {
                return interaction.editReply({
                    embeds: [createEmbed({
                        title: 'Error',
                        description: `Could not find an accessible text channel in server **${guild.name}**.`,
                        type: 'error'
                    })]
                });
            }
        }
        
        try {
            // Use the channel name in the log so we can see which channel was used
            logger.info(`Command executed by bot: ${commandName} in #${targetChannel.name} (${guild.name}, ${serverId})`);
            
            // Track the result of the command execution
            let result = null;
            
            // Create a special reply function that captures the result
            const captureReply = async (replyData) => {
                result = replyData; // Store the reply data
                return { id: 'remote-exec-response' }; // Return a mock message to prevent errors
            };
            
            // Create a mock message for the command to use - using bot's identity instead of user's
            const mockMessage = {
                content: `!${commandName} ${commandArgs.join(' ')}`,
                // Use the bot's user object instead of the interaction user
                author: client.user,
                guild: guild,
                channel: targetChannel,
                // Use the bot's member object in the guild instead of the user's
                member: guild.members.me,
                reply: captureReply,
                deletable: false,
                // Add a special flag to identify this as a remote execution
                isRemoteExecution: true,
                // Store the real executor for internal tracking only
                realExecutor: {
                    id: interaction.user.id,
                    tag: interaction.user.tag
                },
                // Add mentions property with Discord.js Collections instead of Maps
                mentions: {
                    members: new Collection(),
                    users: new Collection(),
                    roles: new Collection(),
                    channels: new Collection(),
                    everyone: false
                }
            };
            
            // Process mentions in the command arguments
            for (const arg of commandArgs) {
                // Check for user/member mentions like @user
                const userMentionMatch = arg.match(/<@!?(\d+)>/);
                if (userMentionMatch) {
                    const userId = userMentionMatch[1];
                    try {
                        const user = await client.users.fetch(userId);
                        if (user) {
                            mockMessage.mentions.users.set(user.id, user);
                            
                            const member = await guild.members.fetch(userId).catch(() => null);
                            if (member) {
                                mockMessage.mentions.members.set(member.id, member);
                            }
                        }
                    } catch (error) {
                        logger.warn(`Could not resolve user mention ${userId} in remote execution`);
                    }
                    continue;
                }
                
                // Check for direct user IDs (for commands like ban, kick that accept IDs)
                if (/^\d{17,19}$/.test(arg)) {
                    // This looks like a user ID (17-19 digits)
                    const userId = arg;
                    try {
                        const user = await client.users.fetch(userId);
                        if (user) {
                            mockMessage.mentions.users.set(user.id, user);
                            
                            const member = await guild.members.fetch(userId).catch(() => null);
                            if (member) {
                                mockMessage.mentions.members.set(member.id, member);
                            }
                        }
                    } catch (error) {
                        logger.warn(`Could not resolve user ID ${userId} in remote execution`);
                    }
                    continue;
                }
                
                // Check for role mentions
                const roleMentionMatch = arg.match(/<@&(\d+)>/);
                if (roleMentionMatch) {
                    const roleId = roleMentionMatch[1];
                    const role = guild.roles.cache.get(roleId);
                    if (role) {
                        mockMessage.mentions.roles.set(role.id, role);
                    }
                    continue;
                }
                
                // Check for channel mentions
                const channelMentionMatch = arg.match(/<#(\d+)>/);
                if (channelMentionMatch) {
                    const channelId = channelMentionMatch[1];
                    const channel = guild.channels.cache.get(channelId);
                    if (channel) {
                        mockMessage.mentions.channels.set(channel.id, channel);
                    }
                }
            }
            
            // Execute the command in the remote guild context with the bot's identity
            await command.execute(mockMessage, commandArgs, client);
            
            // If we have a result, forward it to the original interaction
            if (result) {
                interaction.editReply({
                    embeds: [createEmbed({
                        title: `Remote Execution Result (${guild.name})`,
                        description: `Command \`${commandName}\` executed remotely.`,
                        type: 'success',
                        footer: { text: `Server ID: ${serverId}` }
                    })]
                });
                
                // If there are embeds, send those separately
                if (result.embeds && result.embeds.length > 0) {
                    await interaction.followUp({ embeds: result.embeds });
                }
                
                // If there's content, send that too
                if (result.content) {
                    await interaction.followUp({ content: result.content });
                }
            } else {
                interaction.editReply({
                    embeds: [createEmbed({
                        title: `Remote Execution (${guild.name})`,
                        description: `Command \`${commandName}\` executed remotely, but no direct response was captured.`,
                        type: 'info',
                        footer: { text: `Server ID: ${serverId}` }
                    })]
                });
            }
        } catch (error) {
            // Changed log message to maintain bot execution appearance
            logger.error(`Error executing command ${commandName} in ${serverId}:`, error);
            
            return interaction.editReply({
                embeds: [createEmbed({
                    title: 'Command Error',
                    description: `Failed to execute command remotely: ${error.message}`,
                    type: 'error'
                })]
            });
        }
    }
};