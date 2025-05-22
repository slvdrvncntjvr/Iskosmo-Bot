const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const { createEmbed } = require('../../utils/embedBuilder');
const logger = require('../../utils/logger');

module.exports = {
    name: 'nuke',
    description: 'Delete and recreate a channel (admin only)',
    usage: '<channel> [all]',
    category: 'moderation',
    guildOnly: true,
    adminOnly: true,
    permissions: [PermissionFlagsBits.ManageChannels, PermissionFlagsBits.ManageGuild],
    
    slashCommand: new SlashCommandBuilder()
        .setName('nuke')
        .setDescription('Delete and recreate a channel (admin only)')
        .addChannelOption(option => 
            option.setName('channel')
                .setDescription('The channel to nuke (or "all" for all channels)')
                .setRequired(false))
        .addBooleanOption(option =>
            option.setName('all')
                .setDescription('Nuke all channels (server owners only)')
                .setRequired(false))
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels | PermissionFlagsBits.Administrator),
    
    async execute(message, args, client) {
        // Check if user is at least admin
        if (!message.member.permissions.has(PermissionFlagsBits.Administrator)) {
            return message.reply({ 
                embeds: [createEmbed({
                    title: 'Permission Denied',
                    description: 'You need Administrator permission to use this command.',
                    type: 'error'
                })]
            });
        }
        
        // Check for "all" parameter - only server owner and bot owner can do this
        if (args.includes('all')) {
            // Check if user is server owner or bot owner
            const isServerOwner = message.author.id === message.guild.ownerId;
            const isBotOwner = client.isOwner ? client.isOwner(message.author.id) : 
                              (client.config && client.config.owners && client.config.owners.includes(message.author.id));
                              
            if (!isServerOwner && !isBotOwner) {
                return message.reply({ 
                    embeds: [createEmbed({
                        title: 'Permission Denied',
                        description: 'Only the server owner can nuke all channels.',
                        type: 'error'
                    })]
                });
            }
            
            // Confirm this destructive action
            const confirmMessage = await message.reply({ 
                embeds: [createEmbed({
                    title: '⚠️ Dangerous Action',
                    description: 'Are you sure you want to nuke ALL channels in this server? This will delete and recreate all channels with the same settings. This action cannot be undone.\n\nType `CONFIRM` to proceed.',
                    type: 'warning'
                })]
            });
            
            try {
                const filter = m => m.author.id === message.author.id && m.content === 'CONFIRM';
                const collected = await message.channel.awaitMessages({ 
                    filter, 
                    max: 1, 
                    time: 30000, 
                    errors: ['time'] 
                });
                
                // User confirmed, proceed with nuking all channels
                return this.nukeAllChannels(message);
                
            } catch (error) {
                // User didn't confirm in time
                return confirmMessage.edit({ 
                    embeds: [createEmbed({
                        title: 'Operation Cancelled',
                        description: 'Nuke all operation cancelled due to timeout.',
                        type: 'info'
                    })]
                });
            }
        }
        
        // Single channel nuke
        let targetChannel;
        
        if (args.length === 0) {
            // If no arguments, nuke the current channel
            targetChannel = message.channel;
        } else {
            // Try to find the mentioned channel
            targetChannel = message.mentions.channels.first() || 
                           message.guild.channels.cache.get(args[0]) ||
                           message.guild.channels.cache.find(c => c.name.toLowerCase() === args[0].toLowerCase());
        }
        
        if (!targetChannel) {
            return message.reply({ 
                embeds: [createEmbed({
                    title: 'Error',
                    description: 'Please specify a valid channel to nuke.',
                    type: 'error'
                })]
            });
        }
        
        // Check if the bot has permission to manage this channel
        if (!targetChannel.manageable) {
            return message.reply({ 
                embeds: [createEmbed({
                    title: 'Error',
                    description: 'I don\'t have permission to manage that channel.',
                    type: 'error'
                })]
            });
        }
        
        // Confirm nuke
        if (targetChannel.id === message.channel.id) {
            // If nuking the current channel, send a special confirmation
            const confirmMessage = await message.reply({ 
                embeds: [createEmbed({
                    title: '⚠️ Channel Nuke',
                    description: 'Are you sure you want to nuke THIS channel? This will delete and recreate it with the same settings.\n\nType `CONFIRM` to proceed.',
                    type: 'warning'
                })]
            });
            
            try {
                const filter = m => m.author.id === message.author.id && m.content === 'CONFIRM';
                const collected = await message.channel.awaitMessages({ 
                    filter, 
                    max: 1, 
                    time: 30000, 
                    errors: ['time'] 
                });
                
                // Store info before nuking
                const channelName = targetChannel.name;
                const channelPosition = targetChannel.position;
                const channelTopic = targetChannel.topic;
                const channelType = targetChannel.type;
                const channelParent = targetChannel.parent;
                const channelPermissions = targetChannel.permissionOverwrites.cache;
                const channelNsfw = targetChannel.nsfw;
                const channelRateLimitPerUser = targetChannel.rateLimitPerUser;
                
                // Log the nuke operation
                logger.info(`${message.author.tag} nuked channel #${channelName} (${targetChannel.id}) in ${message.guild.name}`);
                
                try {
                    // Create a new channel with the same settings
                    const newChannel = await message.guild.channels.create({
                        name: channelName,
                        type: channelType,
                        topic: channelTopic,
                        nsfw: channelNsfw,
                        rateLimitPerUser: channelRateLimitPerUser,
                        parent: channelParent ? channelParent.id : null,
                        permissionOverwrites: [...channelPermissions.values()],
                        position: channelPosition,
                        reason: `Channel nuked by ${message.author.tag}`
                    });
                    
                    // Delete the old channel
                    await targetChannel.delete(`Channel nuked by ${message.author.tag}`);
                    
                    // Send a confirmation message in the new channel
                    await newChannel.send({ 
                        embeds: [createEmbed({
                            title: '☢️ Channel Nuked',
                            description: `This channel has been nuked by ${message.author}!`,
                            type: 'success',
                            image: { url: 'https://media.giphy.com/media/XrNry0aqYWEhi/giphy.gif' }
                        })]
                    });
                    
                    logger.logToDiscord(client, `${message.author.tag} nuked channel #${channelName} in ${message.guild.name}`);
                } catch (error) {
                    logger.error(`Error nuking channel ${channelName}:`, error);
                    
                    if (error.code === 50013) {
                        // Missing permissions
                        try {
                            await message.author.send({ 
                                embeds: [createEmbed({
                                    title: 'Error',
                                    description: `I don't have enough permissions to nuke channel #${channelName}. Make sure I have the Manage Channels permission.`,
                                    type: 'error'
                                })]
                            });
                        } catch (dmError) {
                            // Couldn't DM the user
                        }
                    } else {
                        // Some other error
                        try {
                            await message.author.send({ 
                                embeds: [createEmbed({
                                    title: 'Error',
                                    description: `An error occurred while nuking channel #${channelName}: ${error.message}`,
                                    type: 'error'
                                })]
                            });
                        } catch (dmError) {
                            // Couldn't DM the user
                        }
                    }
                }
                
            } catch (error) {
                // User didn't confirm in time
                return confirmMessage.edit({ 
                    embeds: [createEmbed({
                        title: 'Operation Cancelled',
                        description: 'Nuke operation cancelled due to timeout.',
                        type: 'info'
                    })]
                });
            }
        } else {
            // If nuking a different channel, confirm before proceeding
            const confirmMessage = await message.reply({ 
                embeds: [createEmbed({
                    title: '⚠️ Channel Nuke',
                    description: `Are you sure you want to nuke channel <#${targetChannel.id}>? This will delete and recreate it with the same settings.\n\nType \`CONFIRM\` to proceed.`,
                    type: 'warning'
                })]
            });
            
            try {
                const filter = m => m.author.id === message.author.id && m.content === 'CONFIRM';
                const collected = await message.channel.awaitMessages({ 
                    filter, 
                    max: 1, 
                    time: 30000, 
                    errors: ['time'] 
                });
                
                // Store info before nuking
                const channelName = targetChannel.name;
                const channelPosition = targetChannel.position;
                const channelTopic = targetChannel.topic;
                const channelType = targetChannel.type;
                const channelParent = targetChannel.parent;
                const channelPermissions = targetChannel.permissionOverwrites.cache;
                const channelNsfw = targetChannel.nsfw;
                const channelRateLimitPerUser = targetChannel.rateLimitPerUser;
                
                // Log the nuke operation
                logger.info(`${message.author.tag} nuked channel #${channelName} (${targetChannel.id}) in ${message.guild.name}`);
                
                try {
                    // Create a new channel with the same settings
                    const newChannel = await message.guild.channels.create({
                        name: channelName,
                        type: channelType,
                        topic: channelTopic,
                        nsfw: channelNsfw,
                        rateLimitPerUser: channelRateLimitPerUser,
                        parent: channelParent ? channelParent.id : null,
                        permissionOverwrites: [...channelPermissions.values()],
                        position: channelPosition,
                        reason: `Channel nuked by ${message.author.tag}`
                    });
                    
                    // Delete the old channel
                    await targetChannel.delete(`Channel nuked by ${message.author.tag}`);
                    
                    // Send a confirmation message in the new channel
                    await newChannel.send({ 
                        embeds: [createEmbed({
                            title: '☢️ Channel Nuked',
                            description: `This channel has been nuked by ${message.author}!`,
                            type: 'success',
                            image: { url: 'https://media.giphy.com/media/XrNry0aqYWEhi/giphy.gif' }
                        })]
                    });
                    
                    // Send confirmation to the command user
                    await message.reply({ 
                        embeds: [createEmbed({
                            title: 'Channel Nuked',
                            description: `Channel <#${newChannel.id}> has been successfully nuked.`,
                            type: 'success'
                        })]
                    });
                    
                    logger.logToDiscord(client, `${message.author.tag} nuked channel #${channelName} in ${message.guild.name}`);
                } catch (error) {
                    logger.error(`Error nuking channel ${channelName}:`, error);
                    
                    return message.reply({ 
                        embeds: [createEmbed({
                            title: 'Error',
                            description: `An error occurred while nuking the channel: ${error.message}`,
                            type: 'error'
                        })]
                    });
                }
                
            } catch (error) {
                // User didn't confirm in time
                return confirmMessage.edit({ 
                    embeds: [createEmbed({
                        title: 'Operation Cancelled',
                        description: 'Nuke operation cancelled due to timeout.',
                        type: 'info'
                    })]
                });
            }
        }
    },
    
    async executeSlash(interaction, client) {
        // Check if user is at least admin
        if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
            return interaction.reply({ 
                embeds: [createEmbed({
                    title: 'Permission Denied',
                    description: 'You need Administrator permission to use this command.',
                    type: 'error'
                })],
                ephemeral: true
            });
        }
        
        // Check for "all" parameter - only server owner can do this
        const nukeAll = interaction.options.getBoolean('all');
        
        if (nukeAll) {
            // Check if user is server owner or bot owner
            const isServerOwner = interaction.user.id === interaction.guild.ownerId;
            const isBotOwner = client.isOwner ? client.isOwner(interaction.user.id) : 
                              (client.config && client.config.owners && client.config.owners.includes(interaction.user.id));
                              
            if (!isServerOwner && !isBotOwner) {
                return interaction.reply({ 
                    embeds: [createEmbed({
                        title: 'Permission Denied',
                        description: 'Only the server owner can nuke all channels.',
                        type: 'error'
                    })],
                    ephemeral: true
                });
            }
            
            // Ask for confirmation
            const confirmEmbed = createEmbed({
                title: '⚠️ Dangerous Action',
                description: 'Are you sure you want to nuke ALL channels in this server? This will delete and recreate all channels with the same settings. This action cannot be undone.',
                type: 'warning'
            });
            
            // Defer the reply as we need time to process
            await interaction.deferReply();
            
            // Request confirmation before proceeding
            await interaction.editReply({
                embeds: [confirmEmbed],
                components: [
                    {
                        type: 1, // Action Row
                        components: [
                            {
                                type: 2, // Button
                                style: 4, // Danger
                                customId: 'nuke_all_confirm',
                                label: 'Confirm Nuke ALL Channels'
                            },
                            {
                                type: 2, // Button
                                style: 2, // Secondary
                                customId: 'nuke_all_cancel',
                                label: 'Cancel'
                            }
                        ]
                    }
                ]
            });
            
            // Wait for button interaction
            try {
                const filter = i => i.customId.startsWith('nuke_all_') && i.user.id === interaction.user.id;
                const buttonResponse = await interaction.channel.awaitMessageComponent({
                    filter,
                    time: 30000 // 30 seconds to respond
                });
                
                if (buttonResponse.customId === 'nuke_all_cancel') {
                    return buttonResponse.update({
                        embeds: [createEmbed({
                            title: 'Operation Cancelled',
                            description: 'Nuke all operation cancelled.',
                            type: 'info'
                        })],
                        components: []
                    });
                }
                
                if (buttonResponse.customId === 'nuke_all_confirm') {
                    // User confirmed, proceed with nuking all channels
                    await buttonResponse.update({
                        embeds: [createEmbed({
                            title: 'Processing',
                            description: 'Nuking all channels... This may take a while.',
                            type: 'info'
                        })],
                        components: []
                    });
                    
                    return this.nukeAllChannelsSlash(interaction, client);
                }
            } catch (error) {
                // Timeout or other error
                return interaction.editReply({
                    embeds: [createEmbed({
                        title: 'Operation Cancelled',
                        description: 'Nuke all operation cancelled due to timeout.',
                        type: 'info'
                    })],
                    components: []
                });
            }
            
            return;
        }
        
        // Single channel nuke
        const targetChannel = interaction.options.getChannel('channel') || interaction.channel;
        
        // Check if the bot has permission to manage this channel
        if (!targetChannel.manageable) {
            return interaction.reply({ 
                embeds: [createEmbed({
                    title: 'Error',
                    description: 'I don\'t have permission to manage that channel.',
                    type: 'error'
                })],
                ephemeral: true
            });
        }
        
        // Confirm nuke with buttons
        const confirmEmbed = createEmbed({
            title: '⚠️ Channel Nuke',
            description: `Are you sure you want to nuke channel <#${targetChannel.id}>? This will delete and recreate it with the same settings.`,
            type: 'warning'
        });
        
        await interaction.reply({
            embeds: [confirmEmbed],
            components: [
                {
                    type: 1, // Action Row
                    components: [
                        {
                            type: 2, // Button
                            style: 4, // Danger
                            customId: 'nuke_confirm',
                            label: 'Confirm Nuke'
                        },
                        {
                            type: 2, // Button
                            style: 2, // Secondary
                            customId: 'nuke_cancel',
                            label: 'Cancel'
                        }
                    ]
                }
            ]
        });
        
        // Wait for button interaction
        try {
            const filter = i => i.customId.startsWith('nuke_') && i.user.id === interaction.user.id;
            const buttonResponse = await interaction.channel.awaitMessageComponent({
                filter,
                time: 30000 // 30 seconds to respond
            });
            
            if (buttonResponse.customId === 'nuke_cancel') {
                return buttonResponse.update({
                    embeds: [createEmbed({
                        title: 'Operation Cancelled',
                        description: 'Nuke operation cancelled.',
                        type: 'info'
                    })],
                    components: []
                });
            }
            
            if (buttonResponse.customId === 'nuke_confirm') {
                // Store info before nuking
                const channelName = targetChannel.name;
                const channelPosition = targetChannel.position;
                const channelTopic = targetChannel.topic;
                const channelType = targetChannel.type;
                const channelParent = targetChannel.parent;
                const channelPermissions = targetChannel.permissionOverwrites.cache;
                const channelNsfw = targetChannel.nsfw;
                const channelRateLimitPerUser = targetChannel.rateLimitPerUser;
                
                // Log the nuke operation
                logger.info(`${interaction.user.tag} nuked channel #${channelName} (${targetChannel.id}) in ${interaction.guild.name}`);
                
                // Update button response
                await buttonResponse.update({
                    embeds: [createEmbed({
                        title: 'Processing',
                        description: 'Nuking channel...',
                        type: 'info'
                    })],
                    components: []
                });
                
                try {
                    // If the channel being nuked is the same as the interaction channel
                    const isCurrentChannel = targetChannel.id === interaction.channel.id;
                    
                    // Create a new channel with the same settings
                    const newChannel = await interaction.guild.channels.create({
                        name: channelName,
                        type: channelType,
                        topic: channelTopic,
                        nsfw: channelNsfw,
                        rateLimitPerUser: channelRateLimitPerUser,
                        parent: channelParent ? channelParent.id : null,
                        permissionOverwrites: [...channelPermissions.values()],
                        position: channelPosition,
                        reason: `Channel nuked by ${interaction.user.tag}`
                    });
                    
                    // Delete the old channel
                    await targetChannel.delete(`Channel nuked by ${interaction.user.tag}`);
                    
                    // Send a confirmation message in the new channel
                    await newChannel.send({ 
                        embeds: [createEmbed({
                            title: '☢️ Channel Nuked',
                            description: `This channel has been nuked by ${interaction.user}!`,
                            type: 'success',
                            image: { url: 'https://media.giphy.com/media/XrNry0aqYWEhi/giphy.gif' }
                        })]
                    });
                    
                    // If we didn't nuke the interaction channel, tell them it's done
                    if (!isCurrentChannel) {
                        try {
                            await interaction.user.send({ 
                                embeds: [createEmbed({
                                    title: 'Channel Nuked',
                                    description: `Channel #${channelName} has been successfully nuked in ${interaction.guild.name}.`,
                                    type: 'success'
                                })]
                            });
                        } catch (dmError) {
                            // Couldn't DM the user, but that's okay
                        }
                    }
                    
                    logger.logToDiscord(client, `${interaction.user.tag} nuked channel #${channelName} in ${interaction.guild.name}`);
                } catch (error) {
                    logger.error(`Error nuking channel ${channelName}:`, error);
                    
                    // Send error via DM if possible
                    try {
                        await interaction.user.send({ 
                            embeds: [createEmbed({
                                title: 'Error',
                                description: `An error occurred while nuking channel #${channelName}: ${error.message}`,
                                type: 'error'
                            })]
                        });
                    } catch (dmError) {
                        // Couldn't DM, find another channel to send the error
                        const anyTextChannel = interaction.guild.channels.cache
                            .find(c => c.type === 0 && c.id !== targetChannel.id && 
                                   c.permissionsFor(interaction.guild.members.me).has(['SendMessages']));
                                   
                        if (anyTextChannel) {
                            anyTextChannel.send({
                                content: `${interaction.user}`,
                                embeds: [createEmbed({
                                    title: 'Nuke Error',
                                    description: `An error occurred while nuking channel #${channelName}: ${error.message}`,
                                    type: 'error'
                                })]
                            }).catch(() => {});
                        }
                    }
                }
            }
        } catch (error) {
            // Timeout or other error
            try {
                await interaction.editReply({
                    embeds: [createEmbed({
                        title: 'Operation Cancelled',
                        description: 'Nuke operation cancelled due to timeout.',
                        type: 'info'
                    })],
                    components: []
                });
            } catch (e) {
                // Handle the case where the message was already deleted
            }
        }
    },
    
    // Helper method to nuke all channels
    async nukeAllChannels(message) {
        await message.reply({ 
            embeds: [createEmbed({
                title: 'Processing',
                description: 'Nuking all channels... This may take a while.',
                type: 'info'
            })]
        });
        
        try {
            // Get all channels in the guild
            const allChannels = message.guild.channels.cache.filter(c => c.type !== 4); // Exclude categories first pass
            const categories = message.guild.channels.cache.filter(c => c.type === 4);
            
            // Store channel details for recreation
            const channelsToRecreate = [];
            
            // First, gather information about each channel
            for (const [channelId, channel] of allChannels) {
                channelsToRecreate.push({
                    name: channel.name,
                    type: channel.type,
                    topic: channel.topic,
                    nsfw: channel.nsfw,
                    rateLimitPerUser: channel.rateLimitPerUser,
                    parent: channel.parent ? channel.parent.id : null,
                    permissionOverwrites: [...channel.permissionOverwrites.cache.values()],
                    position: channel.position,
                    bitrate: channel.bitrate,
                    userLimit: channel.userLimit,
                    rtcRegion: channel.rtcRegion,
                    videoQualityMode: channel.videoQualityMode
                });
            }
            
            // Store category details for recreation
            const categoriesToRecreate = [];
            
            for (const [categoryId, category] of categories) {
                categoriesToRecreate.push({
                    name: category.name,
                    position: category.position,
                    permissionOverwrites: [...category.permissionOverwrites.cache.values()]
                });
            }
            
            // Make sure we create a "safety channel" where we can send updates
            const safetyChannel = await message.guild.channels.create({
                name: 'nuke-recovery',
                type: 0,
                permissionOverwrites: [
                    {
                        id: message.guild.id,
                        deny: ['SendMessages'],
                        allow: ['ViewChannel']
                    },
                    {
                        id: message.author.id,
                        allow: ['SendMessages', 'ViewChannel']
                    }
                ],
                reason: 'Safety channel for nuke recovery'
            });
            
            await safetyChannel.send({
                content: `${message.author}`,
                embeds: [createEmbed({
                    title: '☢️ Guild Nuke In Progress',
                    description: 'This channel was created as a safety measure during the server nuke process. All channels are being recreated with their original settings.',
                    type: 'warning'
                })]
            });
            
            // First, recreate categories
            const newCategories = new Map();
            
            for (const categoryData of categoriesToRecreate) {
                try {
                    const newCategory = await message.guild.channels.create({
                        name: categoryData.name,
                        type: 4,
                        permissionOverwrites: categoryData.permissionOverwrites,
                        position: categoryData.position,
                        reason: `Server nuke by ${message.author.tag}`
                    });
                    
                    // Store mapping of old categories to new ones
                    const oldCategoryId = categories.find(c => c.name === categoryData.name)?.id;
                    if (oldCategoryId) {
                        newCategories.set(oldCategoryId, newCategory.id);
                    }
                    
                    await safetyChannel.send({
                        embeds: [createEmbed({
                            title: 'Category Recreated',
                            description: `Category **${categoryData.name}** has been recreated.`,
                            type: 'info'
                        })]
                    });
                } catch (error) {
                    logger.error(`Error recreating category ${categoryData.name}:`, error);
                    await safetyChannel.send({
                        embeds: [createEmbed({
                            title: 'Error',
                            description: `Failed to recreate category **${categoryData.name}**: ${error.message}`,
                            type: 'error'
                        })]
                    });
                }
            }
            
            // Now recreate all channels
            for (const channelData of channelsToRecreate) {
                try {
                    // Update parent ID if we have a mapping
                    if (channelData.parent && newCategories.has(channelData.parent)) {
                        channelData.parent = newCategories.get(channelData.parent);
                    }
                    
                    const newChannel = await message.guild.channels.create({
                        name: channelData.name,
                        type: channelData.type,
                        topic: channelData.topic,
                        nsfw: channelData.nsfw,
                        rateLimitPerUser: channelData.rateLimitPerUser,
                        parent: channelData.parent,
                        permissionOverwrites: channelData.permissionOverwrites,
                        position: channelData.position,
                        bitrate: channelData.bitrate,
                        userLimit: channelData.userLimit,
                        rtcRegion: channelData.rtcRegion,
                        videoQualityMode: channelData.videoQualityMode,
                        reason: `Server nuke by ${message.author.tag}`
                    });
                    
                    // If it's a text channel, send a confirmation message
                    if (newChannel.type === 0) {
                        await newChannel.send({
                            embeds: [createEmbed({
                                title: '☢️ Channel Recreated',
                                description: `This channel has been recreated as part of a server-wide nuke by ${message.author}.`,
                                type: 'info'
                            })]
                        });
                    }
                    
                    await safetyChannel.send({
                        embeds: [createEmbed({
                            title: 'Channel Recreated',
                            description: `Channel **${channelData.name}** has been recreated.`,
                            type: 'info'
                        })]
                    });
                } catch (error) {
                    logger.error(`Error recreating channel ${channelData.name}:`, error);
                    await safetyChannel.send({
                        embeds: [createEmbed({
                            title: 'Error',
                            description: `Failed to recreate channel **${channelData.name}**: ${error.message}`,
                            type: 'error'
                        })]
                    });
                }
            }
            
            // Delete all old channels, including the safety channel but excluding categories (they'll be deleted last)
            const oldChannelsWithoutCategories = message.guild.channels.cache.filter(c => 
                c.id !== safetyChannel.id && c.type !== 4
            );
            
            for (const [channelId, channel] of oldChannelsWithoutCategories) {
                try {
                    await channel.delete(`Server nuke by ${message.author.tag}`);
                } catch (error) {
                    logger.error(`Error deleting channel ${channel.name}:`, error);
                    await safetyChannel.send({
                        embeds: [createEmbed({
                            title: 'Error',
                            description: `Failed to delete channel **${channel.name}**: ${error.message}`,
                            type: 'error'
                        })]
                    });
                }
            }
            
            // Now delete the categories
            for (const [categoryId, category] of categories) {
                try {
                    await category.delete(`Server nuke by ${message.author.tag}`);
                } catch (error) {
                    logger.error(`Error deleting category ${category.name}:`, error);
                    await safetyChannel.send({
                        embeds: [createEmbed({
                            title: 'Error',
                            description: `Failed to delete category **${category.name}**: ${error.message}`,
                            type: 'error'
                        })]
                    });
                }
            }
            
            // Final confirmation
            await safetyChannel.send({
                content: `${message.author}`,
                embeds: [createEmbed({
                    title: '✅ Server Nuke Complete',
                    description: 'All channels have been recreated. This recovery channel will be automatically deleted in 60 seconds.',
                    type: 'success'
                })]
            });
            
            // Wait 1 minute then delete safety channel
            setTimeout(async () => {
                try {
                    await safetyChannel.delete(`Nuke recovery complete - ${message.author.tag}`);
                } catch (error) {
                    logger.error('Error deleting safety channel:', error);
                }
            }, 60000);
            
            logger.info(`${message.author.tag} nuked ALL channels in ${message.guild.name}`);
            logger.logToDiscord(client, `${message.author.tag} nuked ALL channels in ${message.guild.name}`);
            
        } catch (error) {
            logger.error(`Error nuking all channels in ${message.guild.name}:`, error);
            
            return message.reply({ 
                embeds: [createEmbed({
                    title: 'Error',
                    description: `An error occurred during the nuke all operation: ${error.message}`,
                    type: 'error'
                })]
            });
        }
    },
    
    // Slash command version of nuke all channels
    async nukeAllChannelsSlash(interaction, client) {
        try {
            // Get all channels in the guild
            const allChannels = interaction.guild.channels.cache.filter(c => c.type !== 4); // Exclude categories first pass
            const categories = interaction.guild.channels.cache.filter(c => c.type === 4);
            
            // Store channel details for recreation
            const channelsToRecreate = [];
            
            // First, gather information about each channel
            for (const [channelId, channel] of allChannels) {
                channelsToRecreate.push({
                    name: channel.name,
                    type: channel.type,
                    topic: channel.topic,
                    nsfw: channel.nsfw,
                    rateLimitPerUser: channel.rateLimitPerUser,
                    parent: channel.parent ? channel.parent.id : null,
                    permissionOverwrites: [...channel.permissionOverwrites.cache.values()],
                    position: channel.position,
                    bitrate: channel.bitrate,
                    userLimit: channel.userLimit,
                    rtcRegion: channel.rtcRegion,
                    videoQualityMode: channel.videoQualityMode
                });
            }
            
            // Store category details for recreation
            const categoriesToRecreate = [];
            
            for (const [categoryId, category] of categories) {
                categoriesToRecreate.push({
                    name: category.name,
                    position: category.position,
                    permissionOverwrites: [...category.permissionOverwrites.cache.values()]
                });
            }
            
            // Make sure we create a "safety channel" where we can send updates
            const safetyChannel = await interaction.guild.channels.create({
                name: 'nuke-recovery',
                type: 0,
                permissionOverwrites: [
                    {
                        id: interaction.guild.id,
                        deny: ['SendMessages'],
                        allow: ['ViewChannel']
                    },
                    {
                        id: interaction.user.id,
                        allow: ['SendMessages', 'ViewChannel']
                    }
                ],
                reason: 'Safety channel for nuke recovery'
            });
            
            await safetyChannel.send({
                content: `${interaction.user}`,
                embeds: [createEmbed({
                    title: '☢️ Guild Nuke In Progress',
                    description: 'This channel was created as a safety measure during the server nuke process. All channels are being recreated with their original settings.',
                    type: 'warning'
                })]
            });
            
            // First, recreate categories
            const newCategories = new Map();
            
            for (const categoryData of categoriesToRecreate) {
                try {
                    const newCategory = await interaction.guild.channels.create({
                        name: categoryData.name,
                        type: 4,
                        permissionOverwrites: categoryData.permissionOverwrites,
                        position: categoryData.position,
                        reason: `Server nuke by ${interaction.user.tag}`
                    });
                    
                    // Store mapping of old categories to new ones
                    const oldCategoryId = categories.find(c => c.name === categoryData.name)?.id;
                    if (oldCategoryId) {
                        newCategories.set(oldCategoryId, newCategory.id);
                    }
                    
                    await safetyChannel.send({
                        embeds: [createEmbed({
                            title: 'Category Recreated',
                            description: `Category **${categoryData.name}** has been recreated.`,
                            type: 'info'
                        })]
                    });
                } catch (error) {
                    logger.error(`Error recreating category ${categoryData.name}:`, error);
                    await safetyChannel.send({
                        embeds: [createEmbed({
                            title: 'Error',
                            description: `Failed to recreate category **${categoryData.name}**: ${error.message}`,
                            type: 'error'
                        })]
                    });
                }
            }
            
            // Now recreate all channels
            for (const channelData of channelsToRecreate) {
                try {
                    // Update parent ID if we have a mapping
                    if (channelData.parent && newCategories.has(channelData.parent)) {
                        channelData.parent = newCategories.get(channelData.parent);
                    }
                    
                    const newChannel = await interaction.guild.channels.create({
                        name: channelData.name,
                        type: channelData.type,
                        topic: channelData.topic,
                        nsfw: channelData.nsfw,
                        rateLimitPerUser: channelData.rateLimitPerUser,
                        parent: channelData.parent,
                        permissionOverwrites: channelData.permissionOverwrites,
                        position: channelData.position,
                        bitrate: channelData.bitrate,
                        userLimit: channelData.userLimit,
                        rtcRegion: channelData.rtcRegion,
                        videoQualityMode: channelData.videoQualityMode,
                        reason: `Server nuke by ${interaction.user.tag}`
                    });
                    
                    // If it's a text channel, send a confirmation message
                    if (newChannel.type === 0) {
                        await newChannel.send({
                            embeds: [createEmbed({
                                title: '☢️ Channel Recreated',
                                description: `This channel has been recreated as part of a server-wide nuke by ${interaction.user}.`,
                                type: 'info'
                            })]
                        });
                    }
                    
                    await safetyChannel.send({
                        embeds: [createEmbed({
                            title: 'Channel Recreated',
                            description: `Channel **${channelData.name}** has been recreated.`,
                            type: 'info'
                        })]
                    });
                } catch (error) {
                    logger.error(`Error recreating channel ${channelData.name}:`, error);
                    await safetyChannel.send({
                        embeds: [createEmbed({
                            title: 'Error',
                            description: `Failed to recreate channel **${channelData.name}**: ${error.message}`,
                            type: 'error'
                        })]
                    });
                }
            }
            
            // Delete all old channels, including the safety channel but excluding categories (they'll be deleted last)
            const oldChannelsWithoutCategories = interaction.guild.channels.cache.filter(c => 
                c.id !== safetyChannel.id && c.type !== 4
            );
            
            for (const [channelId, channel] of oldChannelsWithoutCategories) {
                try {
                    await channel.delete(`Server nuke by ${interaction.user.tag}`);
                } catch (error) {
                    logger.error(`Error deleting channel ${channel.name}:`, error);
                    await safetyChannel.send({
                        embeds: [createEmbed({
                            title: 'Error',
                            description: `Failed to delete channel **${channel.name}**: ${error.message}`,
                            type: 'error'
                        })]
                    });
                }
            }
            
            // Now delete the categories
            for (const [categoryId, category] of categories) {
                try {
                    await category.delete(`Server nuke by ${interaction.user.tag}`);
                } catch (error) {
                    logger.error(`Error deleting category ${category.name}:`, error);
                    await safetyChannel.send({
                        embeds: [createEmbed({
                            title: 'Error',
                            description: `Failed to delete category **${category.name}**: ${error.message}`,
                            type: 'error'
                        })]
                    });
                }
            }
            
            // Final confirmation
            await safetyChannel.send({
                content: `${interaction.user}`,
                embeds: [createEmbed({
                    title: '✅ Server Nuke Complete',
                    description: 'All channels have been recreated. This recovery channel will be automatically deleted in 60 seconds.',
                    type: 'success'
                })]
            });
            
            // Wait 1 minute then delete safety channel
            setTimeout(async () => {
                try {
                    await safetyChannel.delete(`Nuke recovery complete - ${interaction.user.tag}`);
                } catch (error) {
                    logger.error('Error deleting safety channel:', error);
                }
            }, 60000);
            
            logger.info(`${interaction.user.tag} nuked ALL channels in ${interaction.guild.name}`);
            logger.logToDiscord(client, `${interaction.user.tag} nuked ALL channels in ${interaction.guild.name}`);
            
        } catch (error) {
            logger.error(`Error nuking all channels in ${interaction.guild.name}:`, error);
            
            try {
                await interaction.user.send({ 
                    embeds: [createEmbed({
                        title: 'Error',
                        description: `An error occurred during the nuke all operation: ${error.message}`,
                        type: 'error'
                    })]
                });
            } catch (dmError) {
                // Couldn't DM the user
            }
        }
    }
};