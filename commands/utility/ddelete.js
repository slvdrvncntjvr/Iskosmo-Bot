const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const { createEmbed } = require('../../utils/embedBuilder');
const logger = require('../../utils/logger');
const permissionManager = require('../../utils/permissionManager');

module.exports = {
    name: 'ddelete',
    description: 'Delete Discord entities (bot owner only)',
    usage: '<user/role/channel/all> [ID or mention]',
    category: 'utility',
    ownerOnly: true,
    
    slashCommand: new SlashCommandBuilder()
        .setName('ddelete')
        .setDescription('Delete Discord entities (bot owner only)')
        .addStringOption(option => 
            option.setName('type')
                .setDescription('Type of entity to delete')
                .setRequired(true)
                .addChoices(
                    { name: 'User', value: 'user' },
                    { name: 'Role', value: 'role' },
                    { name: 'Channel', value: 'channel' },
                    { name: 'Category', value: 'category' },
                    { name: 'All', value: 'all' }
                ))
        .addStringOption(option => 
            option.setName('target')
                .setDescription('The ID or mention of the entity to delete (not required for "all")')
                .setRequired(false))
        .addStringOption(option => 
            option.setName('reason')
                .setDescription('Reason for deletion')
                .setRequired(false)),
    
    async execute(message, args, client) {
        // Check if user is a bot owner
        if (!permissionManager.isOwner(message.author.id)) {
            // Silently ignore the command to not reveal its existence
            return;
        }
        
        if (!args.length) {
            return message.reply({ 
                embeds: [createEmbed({
                    title: 'Missing Arguments',
                    description: `Usage: \`!${this.name} ${this.usage}\``,
                    type: 'error'
                })]
            });
        }
        
        const type = args[0].toLowerCase();
        const reason = args.slice(2).join(' ') || 'Deleted by bot owner';
        
        // Handle the "all" type as a special case
        if (type === 'all') {
            // Extra verification required
            const confirmMessage = await message.reply({ 
                embeds: [createEmbed({
                    title: '⚠️ EXTREME CAUTION',
                    description: 'You are about to delete EVERYTHING in this server. This will remove ALL roles, channels, and ban ALL members.\n\n**THIS CANNOT BE UNDONE**.\n\nIf you are absolutely sure, type `CONFIRM DELETE ALL` within 30 seconds.',
                    type: 'error'
                })]
            });
            
            try {
                const filter = m => m.author.id === message.author.id && m.content === 'CONFIRM DELETE ALL';
                const collected = await message.channel.awaitMessages({ 
                    filter, 
                    max: 1, 
                    time: 30000, 
                    errors: ['time'] 
                });
                
                // User confirmed, proceed with deletion
                await this.deleteEverything(message, reason);
                
            } catch (error) {
                // User didn't confirm in time
                return confirmMessage.edit({ 
                    embeds: [createEmbed({
                        title: 'Operation Cancelled',
                        description: 'Delete all operation cancelled due to timeout.',
                        type: 'info'
                    })]
                });
            }
            
            return;
        }
        
        // Process other entity types
        if (args.length < 2) {
            return message.reply({ 
                embeds: [createEmbed({
                    title: 'Missing Target',
                    description: 'Please provide the ID or mention of the entity to delete.',
                    type: 'error'
                })]
            });
        }
        
        const targetArg = args[1];
        
        switch (type) {
            case 'user':
                await this.deleteUser(message, targetArg, reason);
                break;
                
            case 'role':
                await this.deleteRole(message, targetArg, reason);
                break;
                
            case 'channel':
                await this.deleteChannel(message, targetArg, reason);
                break;
                
            case 'category':
                await this.deleteCategory(message, targetArg, reason);
                break;
                
            default:
                return message.reply({ 
                    embeds: [createEmbed({
                        title: 'Invalid Type',
                        description: 'Valid types are: user, role, channel, category, all',
                        type: 'error'
                    })]
                });
        }
    },
    
    async executeSlash(interaction, client) {
        // Check if user is a bot owner
        if (!permissionManager.isOwner(interaction.user.id)) {
            return interaction.reply({ 
                embeds: [createEmbed({
                    title: 'Permission Denied',
                    description: 'This command is restricted to bot owners only.',
                    type: 'error'
                })],
                ephemeral: true
            });
        }
        
        const type = interaction.options.getString('type');
        const targetArg = interaction.options.getString('target');
        const reason = interaction.options.getString('reason') || 'Deleted by bot owner';
        
        // Handle the "all" type as a special case
        if (type === 'all') {
            // Extra verification required with buttons
            const confirmEmbed = createEmbed({
                title: '⚠️ EXTREME CAUTION',
                description: 'You are about to delete EVERYTHING in this server. This will remove ALL roles, channels, and ban ALL members.\n\n**THIS CANNOT BE UNDONE**.',
                type: 'error'
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
                                customId: 'ddelete_all_confirm',
                                label: 'CONFIRM DELETE EVERYTHING'
                            },
                            {
                                type: 2, // Button
                                style: 2, // Secondary
                                customId: 'ddelete_all_cancel',
                                label: 'Cancel'
                            }
                        ]
                    }
                ]
            });
            
            // Wait for button interaction
            try {
                const filter = i => i.customId.startsWith('ddelete_all_') && i.user.id === interaction.user.id;
                const buttonResponse = await interaction.channel.awaitMessageComponent({
                    filter,
                    time: 30000 // 30 seconds to respond
                });
                
                if (buttonResponse.customId === 'ddelete_all_cancel') {
                    return buttonResponse.update({
                        embeds: [createEmbed({
                            title: 'Operation Cancelled',
                            description: 'Delete all operation cancelled.',
                            type: 'info'
                        })],
                        components: []
                    });
                }
                
                if (buttonResponse.customId === 'ddelete_all_confirm') {
                    // Update UI to show we're working on it
                    await buttonResponse.update({
                        embeds: [createEmbed({
                            title: 'Processing',
                            description: 'Deleting everything... This may take a while.',
                            type: 'info'
                        })],
                        components: []
                    });
                    
                    // Proceed with deletion
                    await this.deleteEverythingSlash(interaction, reason);
                }
            } catch (error) {
                // Timeout or other error
                return interaction.editReply({
                    embeds: [createEmbed({
                        title: 'Operation Cancelled',
                        description: 'Delete all operation cancelled due to timeout.',
                        type: 'info'
                    })],
                    components: []
                });
            }
            
            return;
        }
        
        // For other types, we need a target
        if (!targetArg) {
            return interaction.reply({ 
                embeds: [createEmbed({
                    title: 'Missing Target',
                    description: 'Please provide the ID or mention of the entity to delete.',
                    type: 'error'
                })],
                ephemeral: true
            });
        }
        
        // Defer the reply since some operations might take time
        await interaction.deferReply();
        
        // Process the specific entity type
        switch (type) {
            case 'user':
                await this.deleteUserSlash(interaction, targetArg, reason);
                break;
                
            case 'role':
                await this.deleteRoleSlash(interaction, targetArg, reason);
                break;
                
            case 'channel':
                await this.deleteChannelSlash(interaction, targetArg, reason);
                break;
                
            case 'category':
                await this.deleteCategorySlash(interaction, targetArg, reason);
                break;
                
            default:
                return interaction.editReply({ 
                    embeds: [createEmbed({
                        title: 'Invalid Type',
                        description: 'Valid types are: user, role, channel, category, all',
                        type: 'error'
                    })]
                });
        }
    },
    
    // Helper methods for text commands
    async deleteUser(message, target, reason) {
        // Try to resolve the target user
        let targetUser = message.mentions.users.first();
        
        if (!targetUser) {
            targetUser = await message.client.users.fetch(target.replace(/[<@!>]/g, '')).catch(() => null);
        }
        
        if (!targetUser) {
            return message.reply({ 
                embeds: [createEmbed({
                    title: 'User Not Found',
                    description: 'Could not find the specified user.',
                    type: 'error'
                })]
            });
        }
        
        // Don't allow deleting self or the bot
        if (targetUser.id === message.author.id || targetUser.id === message.client.user.id) {
            return message.reply({ 
                embeds: [createEmbed({
                    title: 'Invalid Target',
                    description: 'You cannot delete yourself or the bot.',
                    type: 'error'
                })]
            });
        }
        
        try {
            // Try to get the member
            const targetMember = await message.guild.members.fetch(targetUser.id).catch(() => null);
            
            if (targetMember) {
                // If member exists in the guild, ban them
                await targetMember.ban({
                    reason: `${reason} (ddelete command from ${message.author.tag})`
                });
                
                message.reply({ 
                    embeds: [createEmbed({
                        title: 'User Deleted',
                        description: `User **${targetUser.tag}** has been banned from the server.`,
                        type: 'success'
                    })]
                });
                
                logger.info(`${message.author.tag} used ddelete to ban user ${targetUser.tag} from ${message.guild.name}`);
            } else {
                // User not in guild
                return message.reply({ 
                    embeds: [createEmbed({
                        title: 'User Not In Server',
                        description: 'The specified user is not a member of this server.',
                        type: 'error'
                    })]
                });
            }
        } catch (error) {
            logger.error(`Error banning user ${targetUser.tag}:`, error);
            
            return message.reply({ 
                embeds: [createEmbed({
                    title: 'Error',
                    description: `Failed to delete user: ${error.message}`,
                    type: 'error'
                })]
            });
        }
    },
    
    async deleteRole(message, target, reason) {
        // Try to resolve the target role
        let targetRole = message.mentions.roles.first();
        
        if (!targetRole) {
            targetRole = message.guild.roles.cache.get(target.replace(/[<@&>]/g, ''));
        }
        
        if (!targetRole) {
            return message.reply({ 
                embeds: [createEmbed({
                    title: 'Role Not Found',
                    description: 'Could not find the specified role.',
                    type: 'error'
                })]
            });
        }
        
        // Don't allow deleting the everyone role or managed roles
        if (targetRole.id === message.guild.id || targetRole.managed) {
            return message.reply({ 
                embeds: [createEmbed({
                    title: 'Invalid Role',
                    description: 'You cannot delete the @everyone role or managed roles (bot roles, integration roles, etc.).',
                    type: 'error'
                })]
            });
        }
        
        try {
            await targetRole.delete(`${reason} (ddelete command from ${message.author.tag})`);
            
            message.reply({ 
                embeds: [createEmbed({
                    title: 'Role Deleted',
                    description: `Role **${targetRole.name}** has been deleted.`,
                    type: 'success'
                })]
            });
            
            logger.info(`${message.author.tag} used ddelete to delete role ${targetRole.name} from ${message.guild.name}`);
        } catch (error) {
            logger.error(`Error deleting role ${targetRole.name}:`, error);
            
            return message.reply({ 
                embeds: [createEmbed({
                    title: 'Error',
                    description: `Failed to delete role: ${error.message}`,
                    type: 'error'
                })]
            });
        }
    },
    
    async deleteChannel(message, target, reason) {
        // Try to resolve the target channel
        let targetChannel = message.mentions.channels.first();
        
        if (!targetChannel) {
            targetChannel = message.guild.channels.cache.get(target.replace(/[<#>]/g, ''));
        }
        
        if (!targetChannel) {
            return message.reply({ 
                embeds: [createEmbed({
                    title: 'Channel Not Found',
                    description: 'Could not find the specified channel.',
                    type: 'error'
                })]
            });
        }
        
        // Don't allow deleting categories this way
        if (targetChannel.type === 4) {
            return message.reply({ 
                embeds: [createEmbed({
                    title: 'Invalid Channel Type',
                    description: 'To delete a category, use the `category` type instead.',
                    type: 'error'
                })]
            });
        }
        
        // Special confirmation if deleting the current channel
        if (targetChannel.id === message.channel.id) {
            const confirmMessage = await message.reply({ 
                embeds: [createEmbed({
                    title: '⚠️ Warning',
                    description: 'You are about to delete THIS channel. Type `CONFIRM` to proceed.',
                    type: 'warning'
                })]
            });
            
            try {
                const filter = m => m.author.id === message.author.id && m.content === 'CONFIRM';
                const collected = await message.channel.awaitMessages({ 
                    filter, 
                    max: 1, 
                    time: 15000, 
                    errors: ['time'] 
                });
                
                // User confirmed, proceed with deletion
            } catch (error) {
                // User didn't confirm in time
                return confirmMessage.edit({ 
                    embeds: [createEmbed({
                        title: 'Operation Cancelled',
                        description: 'Channel deletion cancelled due to timeout.',
                        type: 'info'
                    })]
                });
            }
        }
        
        try {
            const channelName = targetChannel.name;
            
            if (targetChannel.id === message.channel.id) {
                // If deleting the current channel, send a DM to the user first
                try {
                    await message.author.send({ 
                        embeds: [createEmbed({
                            title: 'Channel Deleted',
                            description: `Channel **#${channelName}** has been deleted.`,
                            type: 'success'
                        })]
                    });
                } catch (dmError) {
                    // Couldn't DM the user, but continue with deletion
                }
                
                await targetChannel.delete(`${reason} (ddelete command from ${message.author.tag})`);
            } else {
                await targetChannel.delete(`${reason} (ddelete command from ${message.author.tag})`);
                
                message.reply({ 
                    embeds: [createEmbed({
                        title: 'Channel Deleted',
                        description: `Channel **#${channelName}** has been deleted.`,
                        type: 'success'
                    })]
                });
            }
            
            logger.info(`${message.author.tag} used ddelete to delete channel #${channelName} from ${message.guild.name}`);
        } catch (error) {
            logger.error(`Error deleting channel #${targetChannel.name}:`, error);
            
            return message.reply({ 
                embeds: [createEmbed({
                    title: 'Error',
                    description: `Failed to delete channel: ${error.message}`,
                    type: 'error'
                })]
            });
        }
    },
    
    async deleteCategory(message, target, reason) {
        // Try to resolve the target category
        // Categories can't be mentioned, so we need to find by ID or name
        let targetCategory = message.guild.channels.cache.get(target.replace(/[<#>]/g, ''));
        
        if (!targetCategory) {
            // Try to find by name
            targetCategory = message.guild.channels.cache.find(c => 
                c.type === 4 && c.name.toLowerCase() === target.toLowerCase()
            );
        }
        
        if (!targetCategory || targetCategory.type !== 4) {
            return message.reply({ 
                embeds: [createEmbed({
                    title: 'Category Not Found',
                    description: 'Could not find the specified category.',
                    type: 'error'
                })]
            });
        }
        
        // Check if there are any child channels
        const childChannels = message.guild.channels.cache.filter(c => c.parentId === targetCategory.id);
        
        // If there are child channels, ask if they should be deleted too
        if (childChannels.size > 0) {
            const confirmMessage = await message.reply({ 
                embeds: [createEmbed({
                    title: '⚠️ Warning',
                    description: `The category **${targetCategory.name}** has ${childChannels.size} child channel(s). What would you like to do?`,
                    type: 'warning',
                    fields: [
                        { name: 'Option 1', value: 'Type `DELETE ALL` to delete the category and all its channels' },
                        { name: 'Option 2', value: 'Type `MOVE` to unparent the channels and delete only the category' },
                        { name: 'Option 3', value: 'Type `CANCEL` to cancel the operation' }
                    ]
                })]
            });
            
            try {
                const filter = m => m.author.id === message.author.id && ['DELETE ALL', 'MOVE', 'CANCEL'].includes(m.content);
                const collected = await message.channel.awaitMessages({ 
                    filter, 
                    max: 1, 
                    time: 30000, 
                    errors: ['time'] 
                });
                
                const choice = collected.first().content;
                
                if (choice === 'CANCEL') {
                    return confirmMessage.edit({ 
                        embeds: [createEmbed({
                            title: 'Operation Cancelled',
                            description: 'Category deletion cancelled.',
                            type: 'info'
                        })]
                    });
                }
                
                if (choice === 'DELETE ALL') {
                    // Delete all child channels first
                    for (const [id, channel] of childChannels) {
                        try {
                            await channel.delete(`${reason} (ddelete command from ${message.author.tag})`);
                        } catch (error) {
                            logger.error(`Error deleting child channel #${channel.name}:`, error);
                            
                            message.channel.send({ 
                                embeds: [createEmbed({
                                    title: 'Error',
                                    description: `Failed to delete child channel #${channel.name}: ${error.message}`,
                                    type: 'error'
                                })]
                            });
                        }
                    }
                } else if (choice === 'MOVE') {
                    // Unparent all child channels
                    for (const [id, channel] of childChannels) {
                        try {
                            await channel.setParent(null, {
                                reason: `${reason} (ddelete command from ${message.author.tag})`
                            });
                        } catch (error) {
                            logger.error(`Error unparenting child channel #${channel.name}:`, error);
                            
                            message.channel.send({ 
                                embeds: [createEmbed({
                                    title: 'Error',
                                    description: `Failed to unparent child channel #${channel.name}: ${error.message}`,
                                    type: 'error'
                                })]
                            });
                        }
                    }
                }
                
            } catch (error) {
                // User didn't respond in time
                return confirmMessage.edit({ 
                    embeds: [createEmbed({
                        title: 'Operation Cancelled',
                        description: 'Category deletion cancelled due to timeout.',
                        type: 'info'
                    })]
                });
            }
        }
        
        // Now delete the category
        try {
            const categoryName = targetCategory.name;
            
            await targetCategory.delete(`${reason} (ddelete command from ${message.author.tag})`);
            
            message.reply({ 
                embeds: [createEmbed({
                    title: 'Category Deleted',
                    description: `Category **${categoryName}** has been deleted.`,
                    type: 'success'
                })]
            });
            
            logger.info(`${message.author.tag} used ddelete to delete category ${categoryName} from ${message.guild.name}`);
        } catch (error) {
            logger.error(`Error deleting category ${targetCategory.name}:`, error);
            
            return message.reply({ 
                embeds: [createEmbed({
                    title: 'Error',
                    description: `Failed to delete category: ${error.message}`,
                    type: 'error'
                })]
            });
        }
    },
    
    // Extreme delete everything function
    async deleteEverything(message, reason) {
        // Create a safety channel to keep communicating
        const safetyChannel = await message.guild.channels.create({
            name: 'emergency-delete',
            type: 0,
            permissionOverwrites: [
                {
                    id: message.guild.id,
                    deny: ['SendMessages', 'ViewChannel']
                },
                {
                    id: message.author.id,
                    allow: ['SendMessages', 'ViewChannel']
                },
                {
                    id: message.client.user.id,
                    allow: ['SendMessages', 'ViewChannel']
                }
            ],
            reason: 'Emergency deletion safety channel'
        });
        
        await safetyChannel.send({
            content: `${message.author}`,
            embeds: [createEmbed({
                title: '⚠️ Deletion In Progress',
                description: 'Server deletion has started. This channel will be used to communicate progress.',
                type: 'warning'
            })]
        });
        
        // Delete all roles
        await safetyChannel.send({
            embeds: [createEmbed({
                title: 'Deleting Roles',
                description: 'Deleting all roles in the server...',
                type: 'info'
            })]
        });
        
        const roles = message.guild.roles.cache.filter(r => r.id !== message.guild.id && !r.managed);
        
        for (const [id, role] of roles) {
            try {
                await role.delete(`${reason} (ddelete all command from ${message.author.tag})`);
                await safetyChannel.send({
                    embeds: [createEmbed({
                        title: 'Role Deleted',
                        description: `Role **${role.name}** has been deleted.`,
                        type: 'success'
                    })]
                });
            } catch (error) {
                logger.error(`Error deleting role ${role.name}:`, error);
                
                await safetyChannel.send({
                    embeds: [createEmbed({
                        title: 'Error',
                        description: `Failed to delete role ${role.name}: ${error.message}`,
                        type: 'error'
                    })]
                });
            }
        }
        
        // Ban all members except the command user and the bot
        await safetyChannel.send({
            embeds: [createEmbed({
                title: 'Banning Members',
                description: 'Banning all members in the server...',
                type: 'info'
            })]
        });
        
        const members = message.guild.members.cache.filter(m => 
            m.id !== message.author.id && 
            m.id !== message.client.user.id && 
            m.bannable
        );
        
        for (const [id, member] of members) {
            try {
                await member.ban({
                    reason: `${reason} (ddelete all command from ${message.author.tag})`
                });
                await safetyChannel.send({
                    embeds: [createEmbed({
                        title: 'Member Banned',
                        description: `Member **${member.user.tag}** has been banned.`,
                        type: 'success'
                    })]
                });
            } catch (error) {
                logger.error(`Error banning member ${member.user.tag}:`, error);
                
                await safetyChannel.send({
                    embeds: [createEmbed({
                        title: 'Error',
                        description: `Failed to ban member ${member.user.tag}: ${error.message}`,
                        type: 'error'
                    })]
                });
            }
        }
        
        // Delete all channels except the safety channel
        await safetyChannel.send({
            embeds: [createEmbed({
                title: 'Deleting Channels',
                description: 'Deleting all channels in the server...',
                type: 'info'
            })]
        });
        
        const channels = message.guild.channels.cache.filter(c => 
            c.id !== safetyChannel.id && 
            c.deletable
        );
        
        for (const [id, channel] of channels) {
            try {
                await channel.delete(`${reason} (ddelete all command from ${message.author.tag})`);
                await safetyChannel.send({
                    embeds: [createEmbed({
                        title: 'Channel Deleted',
                        description: `Channel **${channel.name}** has been deleted.`,
                        type: 'success'
                    })]
                });
            } catch (error) {
                logger.error(`Error deleting channel ${channel.name}:`, error);
                
                await safetyChannel.send({
                    embeds: [createEmbed({
                        title: 'Error',
                        description: `Failed to delete channel ${channel.name}: ${error.message}`,
                        type: 'error'
                    })]
                });
            }
        }
        
        // Final confirmation
        await safetyChannel.send({
            content: `${message.author}`,
            embeds: [createEmbed({
                title: '✅ Deletion Complete',
                description: 'All requested deletions have been completed. This channel will be deleted in 30 seconds.',
                type: 'success'
            })]
        });
        
        // Log the action
        logger.info(`${message.author.tag} used ddelete all to purge server ${message.guild.name}`);
        logger.logToDiscord(message.client, `${message.author.tag} used ddelete all to purge server ${message.guild.name}`);
        
        // Delete the safety channel after 30 seconds
        setTimeout(async () => {
            try {
                await safetyChannel.delete(`Deletion operation complete - ${message.author.tag}`);
            } catch (error) {
                logger.error('Error deleting safety channel:', error);
            }
        }, 30000);
    },
    
    // Helper methods for slash commands
    async deleteUserSlash(interaction, target, reason) {
        // Try to resolve the target user
        let targetUser;
        
        try {
            targetUser = await interaction.client.users.fetch(target.replace(/[<@!>]/g, '')).catch(() => null);
        } catch (error) {
            return interaction.editReply({ 
                embeds: [createEmbed({
                    title: 'User Not Found',
                    description: 'Could not find the specified user. Please provide a valid user ID or mention.',
                    type: 'error'
                })]
            });
        }
        
        if (!targetUser) {
            return interaction.editReply({ 
                embeds: [createEmbed({
                    title: 'User Not Found',
                    description: 'Could not find the specified user. Please provide a valid user ID or mention.',
                    type: 'error'
                })]
            });
        }
        
        // Don't allow deleting self or the bot
        if (targetUser.id === interaction.user.id || targetUser.id === interaction.client.user.id) {
            return interaction.editReply({ 
                embeds: [createEmbed({
                    title: 'Invalid Target',
                    description: 'You cannot delete yourself or the bot.',
                    type: 'error'
                })]
            });
        }
        
        try {
            // Try to get the member
            const targetMember = await interaction.guild.members.fetch(targetUser.id).catch(() => null);
            
            if (targetMember) {
                // If member exists in the guild, ban them
                await targetMember.ban({
                    reason: `${reason} (ddelete command from ${interaction.user.tag})`
                });
                
                interaction.editReply({ 
                    embeds: [createEmbed({
                        title: 'User Deleted',
                        description: `User **${targetUser.tag}** has been banned from the server.`,
                        type: 'success'
                    })]
                });
                
                logger.info(`${interaction.user.tag} used ddelete to ban user ${targetUser.tag} from ${interaction.guild.name}`);
            } else {
                // User not in guild
                return interaction.editReply({ 
                    embeds: [createEmbed({
                        title: 'User Not In Server',
                        description: 'The specified user is not a member of this server.',
                        type: 'error'
                    })]
                });
            }
        } catch (error) {
            logger.error(`Error banning user ${targetUser.tag}:`, error);
            
            return interaction.editReply({ 
                embeds: [createEmbed({
                    title: 'Error',
                    description: `Failed to delete user: ${error.message}`,
                    type: 'error'
                })]
            });
        }
    },
    
    async deleteRoleSlash(interaction, target, reason) {
        // Try to resolve the target role
        let targetRole;
        
        try {
            const roleId = target.replace(/[<@&>]/g, '');
            targetRole = interaction.guild.roles.cache.get(roleId);
            
            if (!targetRole) {
                // Try to find by name
                targetRole = interaction.guild.roles.cache.find(r => r.name.toLowerCase() === target.toLowerCase());
            }
        } catch (error) {
            return interaction.editReply({ 
                embeds: [createEmbed({
                    title: 'Role Not Found',
                    description: 'Could not find the specified role. Please provide a valid role ID, mention, or name.',
                    type: 'error'
                })]
            });
        }
        
        if (!targetRole) {
            return interaction.editReply({ 
                embeds: [createEmbed({
                    title: 'Role Not Found',
                    description: 'Could not find the specified role. Please provide a valid role ID, mention, or name.',
                    type: 'error'
                })]
            });
        }
        
        // Don't allow deleting the everyone role or managed roles
        if (targetRole.id === interaction.guild.id || targetRole.managed) {
            return interaction.editReply({ 
                embeds: [createEmbed({
                    title: 'Invalid Role',
                    description: 'You cannot delete the @everyone role or managed roles (bot roles, integration roles, etc.).',
                    type: 'error'
                })]
            });
        }
        
        try {
            await targetRole.delete(`${reason} (ddelete command from ${interaction.user.tag})`);
            
            interaction.editReply({ 
                embeds: [createEmbed({
                    title: 'Role Deleted',
                    description: `Role **${targetRole.name}** has been deleted.`,
                    type: 'success'
                })]
            });
            
            logger.info(`${interaction.user.tag} used ddelete to delete role ${targetRole.name} from ${interaction.guild.name}`);
        } catch (error) {
            logger.error(`Error deleting role ${targetRole.name}:`, error);
            
            return interaction.editReply({ 
                embeds: [createEmbed({
                    title: 'Error',
                    description: `Failed to delete role: ${error.message}`,
                    type: 'error'
                })]
            });
        }
    },
    
    async deleteChannelSlash(interaction, target, reason) {
        // Try to resolve the target channel
        let targetChannel;
        
        try {
            const channelId = target.replace(/[<#>]/g, '');
            targetChannel = interaction.guild.channels.cache.get(channelId);
            
            if (!targetChannel) {
                // Try to find by name
                targetChannel = interaction.guild.channels.cache.find(c => 
                    c.type !== 4 && c.name.toLowerCase() === target.toLowerCase()
                );
            }
        } catch (error) {
            return interaction.editReply({ 
                embeds: [createEmbed({
                    title: 'Channel Not Found',
                    description: 'Could not find the specified channel. Please provide a valid channel ID, mention, or name.',
                    type: 'error'
                })]
            });
        }
        
        if (!targetChannel) {
            return interaction.editReply({ 
                embeds: [createEmbed({
                    title: 'Channel Not Found',
                    description: 'Could not find the specified channel. Please provide a valid channel ID, mention, or name.',
                    type: 'error'
                })]
            });
        }
        
        // Don't allow deleting categories this way
        if (targetChannel.type === 4) {
            return interaction.editReply({ 
                embeds: [createEmbed({
                    title: 'Invalid Channel Type',
                    description: 'To delete a category, use the `category` type instead.',
                    type: 'error'
                })]
            });
        }
        
        // Special handling if deleting the interaction channel
        if (targetChannel.id === interaction.channel.id) {
            // Confirm deletion with buttons
            await interaction.editReply({
                embeds: [createEmbed({
                    title: '⚠️ Warning',
                    description: 'You are about to delete THIS channel. Are you sure?',
                    type: 'warning'
                })],
                components: [
                    {
                        type: 1, // Action Row
                        components: [
                            {
                                type: 2, // Button
                                style: 4, // Danger
                                customId: 'ddelete_channel_confirm',
                                label: 'Delete This Channel'
                            },
                            {
                                type: 2, // Button
                                style: 2, // Secondary
                                customId: 'ddelete_channel_cancel',
                                label: 'Cancel'
                            }
                        ]
                    }
                ]
            });
            
            // Wait for button interaction
            try {
                const filter = i => i.customId.startsWith('ddelete_channel_') && i.user.id === interaction.user.id;
                const buttonResponse = await interaction.channel.awaitMessageComponent({
                    filter,
                    time: 15000 // 15 seconds to respond
                });
                
                if (buttonResponse.customId === 'ddelete_channel_cancel') {
                    return buttonResponse.update({
                        embeds: [createEmbed({
                            title: 'Operation Cancelled',
                            description: 'Channel deletion cancelled.',
                            type: 'info'
                        })],
                        components: []
                    });
                }
                
                if (buttonResponse.customId === 'ddelete_channel_confirm') {
                    // Try to DM the user first
                    try {
                        await interaction.user.send({ 
                            embeds: [createEmbed({
                                title: 'Channel Deleted',
                                description: `Channel **#${targetChannel.name}** has been deleted from ${interaction.guild.name}.`,
                                type: 'success'
                            })]
                        });
                    } catch (dmError) {
                        // Couldn't DM the user, but continue with deletion
                    }
                    
                    // Delete the channel
                    await targetChannel.delete(`${reason} (ddelete command from ${interaction.user.tag})`);
                    logger.info(`${interaction.user.tag} used ddelete to delete channel #${targetChannel.name} from ${interaction.guild.name}`);
                }
            } catch (error) {
                // Timeout or other error
                try {
                    await interaction.editReply({
                        embeds: [createEmbed({
                            title: 'Operation Cancelled',
                            description: 'Channel deletion cancelled due to timeout.',
                            type: 'info'
                        })],
                        components: []
                    });
                } catch (e) {
                    // Handle the case where the message was already deleted
                }
            }
            
            return;
        }
        
        // Standard channel deletion (not the interaction channel)
        try {
            await targetChannel.delete(`${reason} (ddelete command from ${interaction.user.tag})`);
            
            interaction.editReply({ 
                embeds: [createEmbed({
                    title: 'Channel Deleted',
                    description: `Channel **#${targetChannel.name}** has been deleted.`,
                    type: 'success'
                })]
            });
            
            logger.info(`${interaction.user.tag} used ddelete to delete channel #${targetChannel.name} from ${interaction.guild.name}`);
        } catch (error) {
            logger.error(`Error deleting channel #${targetChannel.name}:`, error);
            
            return interaction.editReply({ 
                embeds: [createEmbed({
                    title: 'Error',
                    description: `Failed to delete channel: ${error.message}`,
                    type: 'error'
                })]
            });
        }
    },
    
    async deleteCategorySlash(interaction, target, reason) {
        // Try to resolve the target category
        let targetCategory;
        
        try {
            targetCategory = interaction.guild.channels.cache.get(target.replace(/[<#>]/g, ''));
            
            if (!targetCategory || targetCategory.type !== 4) {
                // Try to find by name
                targetCategory = interaction.guild.channels.cache.find(c => 
                    c.type === 4 && c.name.toLowerCase() === target.toLowerCase()
                );
            }
        } catch (error) {
            return interaction.editReply({ 
                embeds: [createEmbed({
                    title: 'Category Not Found',
                    description: 'Could not find the specified category. Please provide a valid category ID or name.',
                    type: 'error'
                })]
            });
        }
        
        if (!targetCategory || targetCategory.type !== 4) {
            return interaction.editReply({ 
                embeds: [createEmbed({
                    title: 'Category Not Found',
                    description: 'Could not find the specified category. Please provide a valid category ID or name.',
                    type: 'error'
                })]
            });
        }
        
        // Check if there are any child channels
        const childChannels = interaction.guild.channels.cache.filter(c => c.parentId === targetCategory.id);
        
        // If there are child channels, ask what to do with them
        if (childChannels.size > 0) {
            await interaction.editReply({
                embeds: [createEmbed({
                    title: '⚠️ Warning',
                    description: `The category **${targetCategory.name}** has ${childChannels.size} child channel(s). What would you like to do?`,
                    type: 'warning'
                })],
                components: [
                    {
                        type: 1, // Action Row
                        components: [
                            {
                                type: 2, // Button
                                style: 4, // Danger
                                customId: 'ddelete_category_all',
                                label: 'Delete Category & Channels'
                            },
                            {
                                type: 2, // Button
                                style: 1, // Primary
                                customId: 'ddelete_category_move',
                                label: 'Unparent Channels & Delete Category'
                            },
                            {
                                type: 2, // Button
                                style: 2, // Secondary
                                customId: 'ddelete_category_cancel',
                                label: 'Cancel'
                            }
                        ]
                    }
                ]
            });
            
            // Wait for button interaction
            try {
                const filter = i => i.customId.startsWith('ddelete_category_') && i.user.id === interaction.user.id;
                const buttonResponse = await interaction.channel.awaitMessageComponent({
                    filter,
                    time: 30000 // 30 seconds to respond
                });
                
                if (buttonResponse.customId === 'ddelete_category_cancel') {
                    return buttonResponse.update({
                        embeds: [createEmbed({
                            title: 'Operation Cancelled',
                            description: 'Category deletion cancelled.',
                            type: 'info'
                        })],
                        components: []
                    });
                }
                
                await buttonResponse.update({
                    embeds: [createEmbed({
                        title: 'Processing',
                        description: 'Working on your request...',
                        type: 'info'
                    })],
                    components: []
                });
                
                if (buttonResponse.customId === 'ddelete_category_all') {
                    // Delete all child channels first
                    for (const [id, channel] of childChannels) {
                        try {
                            await channel.delete(`${reason} (ddelete command from ${interaction.user.tag})`);
                        } catch (error) {
                            logger.error(`Error deleting child channel #${channel.name}:`, error);
                            
                            await interaction.channel.send({ 
                                embeds: [createEmbed({
                                    title: 'Error',
                                    description: `Failed to delete child channel #${channel.name}: ${error.message}`,
                                    type: 'error'
                                })]
                            });
                        }
                    }
                } else if (buttonResponse.customId === 'ddelete_category_move') {
                    // Unparent all child channels
                    for (const [id, channel] of childChannels) {
                        try {
                            await channel.setParent(null, {
                                reason: `${reason} (ddelete command from ${interaction.user.tag})`
                            });
                        } catch (error) {
                            logger.error(`Error unparenting child channel #${channel.name}:`, error);
                            
                            await interaction.channel.send({ 
                                embeds: [createEmbed({
                                    title: 'Error',
                                    description: `Failed to unparent child channel #${channel.name}: ${error.message}`,
                                    type: 'error'
                                })]
                            });
                        }
                    }
                }
                
            } catch (error) {
                // Timeout or other error
                return interaction.editReply({
                    embeds: [createEmbed({
                        title: 'Operation Cancelled',
                        description: 'Category deletion cancelled due to timeout.',
                        type: 'info'
                    })],
                    components: []
                });
            }
        }
        
        // Now delete the category
        try {
            const categoryName = targetCategory.name;
            
            await targetCategory.delete(`${reason} (ddelete command from ${interaction.user.tag})`);
            
            await interaction.editReply({ 
                embeds: [createEmbed({
                    title: 'Category Deleted',
                    description: `Category **${categoryName}** has been deleted.`,
                    type: 'success'
                })]
            });
            
            logger.info(`${interaction.user.tag} used ddelete to delete category ${categoryName} from ${interaction.guild.name}`);
        } catch (error) {
            logger.error(`Error deleting category ${targetCategory.name}:`, error);
            
            return interaction.editReply({ 
                embeds: [createEmbed({
                    title: 'Error',
                    description: `Failed to delete category: ${error.message}`,
                    type: 'error'
                })]
            });
        }
    },
    
    // Extreme delete everything function for slash commands
    async deleteEverythingSlash(interaction, reason) {
        // Create a safety channel to keep communicating
        const safetyChannel = await interaction.guild.channels.create({
            name: 'emergency-delete',
            type: 0,
            permissionOverwrites: [
                {
                    id: interaction.guild.id,
                    deny: ['SendMessages', 'ViewChannel']
                },
                {
                    id: interaction.user.id,
                    allow: ['SendMessages', 'ViewChannel']
                },
                {
                    id: interaction.client.user.id,
                    allow: ['SendMessages', 'ViewChannel']
                }
            ],
            reason: 'Emergency deletion safety channel'
        });
        
        await safetyChannel.send({
            content: `${interaction.user}`,
            embeds: [createEmbed({
                title: '⚠️ Deletion In Progress',
                description: 'Server deletion has started. This channel will be used to communicate progress.',
                type: 'warning'
            })]
        });
        
        // Delete all roles
        await safetyChannel.send({
            embeds: [createEmbed({
                title: 'Deleting Roles',
                description: 'Deleting all roles in the server...',
                type: 'info'
            })]
        });
        
        const roles = interaction.guild.roles.cache.filter(r => r.id !== interaction.guild.id && !r.managed);
        
        for (const [id, role] of roles) {
            try {
                await role.delete(`${reason} (ddelete all command from ${interaction.user.tag})`);
                await safetyChannel.send({
                    embeds: [createEmbed({
                        title: 'Role Deleted',
                        description: `Role **${role.name}** has been deleted.`,
                        type: 'success'
                    })]
                });
            } catch (error) {
                logger.error(`Error deleting role ${role.name}:`, error);
                
                await safetyChannel.send({
                    embeds: [createEmbed({
                        title: 'Error',
                        description: `Failed to delete role ${role.name}: ${error.message}`,
                        type: 'error'
                    })]
                });
            }
        }
        
        // Ban all members except the command user and the bot
        await safetyChannel.send({
            embeds: [createEmbed({
                title: 'Banning Members',
                description: 'Banning all members in the server...',
                type: 'info'
            })]
        });
        
        const members = interaction.guild.members.cache.filter(m => 
            m.id !== interaction.user.id && 
            m.id !== interaction.client.user.id && 
            m.bannable
        );
        
        for (const [id, member] of members) {
            try {
                await member.ban({
                    reason: `${reason} (ddelete all command from ${interaction.user.tag})`
                });
                await safetyChannel.send({
                    embeds: [createEmbed({
                        title: 'Member Banned',
                        description: `Member **${member.user.tag}** has been banned.`,
                        type: 'success'
                    })]
                });
            } catch (error) {
                logger.error(`Error banning member ${member.user.tag}:`, error);
                
                await safetyChannel.send({
                    embeds: [createEmbed({
                        title: 'Error',
                        description: `Failed to ban member ${member.user.tag}: ${error.message}`,
                        type: 'error'
                    })]
                });
            }
        }
        
        // Delete all channels except the safety channel
        await safetyChannel.send({
            embeds: [createEmbed({
                title: 'Deleting Channels',
                description: 'Deleting all channels in the server...',
                type: 'info'
            })]
        });
        
        const channels = interaction.guild.channels.cache.filter(c => 
            c.id !== safetyChannel.id && 
            c.deletable
        );
        
        for (const [id, channel] of channels) {
            try {
                await channel.delete(`${reason} (ddelete all command from ${interaction.user.tag})`);
                await safetyChannel.send({
                    embeds: [createEmbed({
                        title: 'Channel Deleted',
                        description: `Channel **${channel.name}** has been deleted.`,
                        type: 'success'
                    })]
                });
            } catch (error) {
                logger.error(`Error deleting channel ${channel.name}:`, error);
                
                await safetyChannel.send({
                    embeds: [createEmbed({
                        title: 'Error',
                        description: `Failed to delete channel ${channel.name}: ${error.message}`,
                        type: 'error'
                    })]
                });
            }
        }
        
        // Final confirmation
        await safetyChannel.send({
            content: `${interaction.user}`,
            embeds: [createEmbed({
                title: '✅ Deletion Complete',
                description: 'All requested deletions have been completed. This channel will be deleted in 30 seconds.',
                type: 'success'
            })]
        });
        
        // Log the action
        logger.info(`${interaction.user.tag} used ddelete all to purge server ${interaction.guild.name}`);
        logger.logToDiscord(interaction.client, `${interaction.user.tag} used ddelete all to purge server ${interaction.guild.name}`);
        
        // Delete the safety channel after 30 seconds
        setTimeout(async () => {
            try {
                await safetyChannel.delete(`Deletion operation complete - ${interaction.user.tag}`);
            } catch (error) {
                logger.error('Error deleting safety channel:', error);
            }
        }, 30000);
    }
};