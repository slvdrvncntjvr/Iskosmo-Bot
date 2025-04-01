// commands/fun/snipe.js
const { SlashCommandBuilder } = require('discord.js');
const { createEmbed } = require('../../utils/embedBuilder');
const messageTracker = require('../../utils/messageTracker');
const snipeManager = require('../../utils/snipeManager');
const logger = require('../../utils/logger');

module.exports = {
    name: 'snipe',
    description: 'Show the most recently deleted message in a channel',
    usage: '[#channel] [index]',
    category: 'fun',
    requiresAuth: false,
    
    slashCommand: new SlashCommandBuilder()
        .setName('snipe')
        .setDescription('Show the most recently deleted message in a channel')
        .addChannelOption(option => 
            option.setName('channel')
                .setDescription('Channel to snipe from (defaults to current channel)')
                .setRequired(false))
        .addIntegerOption(option => 
            option.setName('index')
                .setDescription('Which deleted message to show (0 = most recent)')
                .setRequired(false)
                .setMinValue(0)
                .setMaxValue(9)),
    
    async execute(message, args, client) {
        // Parse arguments
        let targetChannelId = message.channel.id;
        let index = 0;
        
        // Check for channel mention
        if (args.length > 0 && args[0].match(/^<#\d+>$/)) {
            const channelMention = args[0];
            targetChannelId = channelMention.replace(/[<#>]/g, '');
            args.shift(); // Remove the channel argument
        }
        
        // Check for index
        if (args.length > 0) {
            const parsedIndex = parseInt(args[0], 10);
            if (!isNaN(parsedIndex) && parsedIndex >= 0 && parsedIndex < 10) {
                index = parsedIndex;
            }
        }
        
        // Get the target channel
        const targetChannel = client.channels.cache.get(targetChannelId);
        
        if (!targetChannel) {
            return message.reply({
                embeds: [createEmbed({
                    title: 'Error',
                    description: 'Invalid channel. Please specify a valid channel.',
                    type: 'error'
                })]
            });
        }
        
        // If target channel is different from current channel, check permissions
        if (targetChannel.id !== message.channel.id) {
            const isOwner = message.author.id === process.env.BOT_OWNER_ID;
            
            // If not the owner, check permissions
            if (!isOwner) {
                // Check if user has permission for cross-channel sniping
                const canSnipe = snipeManager.canSnipeAcrossChannels(message.member, isOwner);
                
                if (!canSnipe) {
                    return message.reply({
                        embeds: [createEmbed({
                            title: 'Permission Denied',
                            description: 'You don\'t have permission to snipe messages from other channels.',
                            type: 'error'
                        })]
                    });
                }
            }
        }
        
        // Get the deleted message
        const deletedMessage = messageTracker.getDeletedMessage(targetChannel.id, index);
        
        if (!deletedMessage) {
            return message.reply({
                embeds: [createEmbed({
                    title: 'No Deleted Messages',
                    description: index === 0 
                        ? `No recently deleted messages found in ${targetChannel}.`
                        : `No deleted message found at index ${index} in ${targetChannel}.`,
                    type: 'info'
                })]
            });
        }

        const timestamp = new Date(deletedMessage.timestamp).toLocaleString();

        const fields = [];
        if (deletedMessage.attachments && deletedMessage.attachments.length > 0) {
            fields.push({
                name: 'Attachments',
                value: deletedMessage.attachments
                    .map(a => `[${a.name}](${a.url})`)
                    .join('\n')
            });
        }

        return message.reply({
            embeds: [createEmbed({
                title: `Sniped Message ${index > 0 ? `(${index + 1} back)` : ''}`,
                description: deletedMessage.content,
                type: 'info',
                author: {
                    name: `${deletedMessage.author.username}#${deletedMessage.author.discriminator}`,
                    icon_url: deletedMessage.author.avatar
                },
                footer: {
                    text: `Deleted at ${timestamp}${targetChannel.id !== message.channel.id ? ` in #${targetChannel.name}` : ''}`
                },
                fields
            })]
        });;
    },
    
    async executeSlash(interaction, client) {
        const targetChannel = interaction.options.getChannel('channel') || interaction.channel;
        const index = interaction.options.getInteger('index') || 0;

        if (targetChannel.id !== interaction.channel.id) {
            const isOwner = interaction.user.id === process.env.BOT_OWNER_ID;

            if (!isOwner) {
                const canSnipe = snipeManager.canSnipeAcrossChannels(interaction.member, isOwner);
                
                if (!canSnipe) {
                    return interaction.reply({
                        embeds: [createEmbed({
                            title: 'Permission Denied',
                            description: 'You don\'t have permission to snipe messages from other channels.',
                            type: 'error'
                        })],
                        ephemeral: true
                    });
                }
            }
        }
        
        // Get the deleted message
        const deletedMessage = messageTracker.getDeletedMessage(targetChannel.id, index);
        
        if (!deletedMessage) {
            return interaction.reply({
                embeds: [createEmbed({
                    title: 'No Deleted Messages',
                    description: index === 0 
                        ? `No recently deleted messages found in ${targetChannel}.`
                        : `No deleted message found at index ${index} in ${targetChannel}.`,
                    type: 'info'
                })],
                ephemeral: true
            });
        }
        
        // Format the timestamp
        const timestamp = new Date(deletedMessage.timestamp).toLocaleString();
        
        // Build embed fields for attachments if any
        const fields = [];
        if (deletedMessage.attachments && deletedMessage.attachments.length > 0) {
            fields.push({
                name: 'Attachments',
                value: deletedMessage.attachments
                    .map(a => `[${a.name}](${a.url})`)
                    .join('\n')
            });
        }

        return interaction.reply({
            embeds: [createEmbed({
                title: `Sniped Message ${index > 0 ? `(${index + 1} back)` : ''}`,
                description: deletedMessage.content,
                type: 'info',
                author: {
                    name: `${deletedMessage.author.username}#${deletedMessage.author.discriminator}`,
                    icon_url: deletedMessage.author.avatar
                },
                footer: {
                    text: `Deleted at ${timestamp}${targetChannel.id !== interaction.channel.id ? ` in #${targetChannel.name}` : ''}`
                },
                fields
            })]
        });;
    }
};