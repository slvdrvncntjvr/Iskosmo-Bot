// commands/fun/snipe.js
const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const { createEmbed } = require('../../utils/embedBuilder');
const messageTracker = require('../../utils/messageTracker');
const logger = require('../../utils/logger');

module.exports = {
    name: 'snipe',
    description: 'Shows the most recently deleted message in the channel',
    category: 'fun',

    slashCommand: new SlashCommandBuilder()
        .setName('snipe')
        .setDescription('Shows the most recently deleted message in the channel'),
    
    async execute(message, args, client) {
        try {
            const deletedMessage = messageTracker.getDeletedMessage(message.channel.id);
            
            if (!deletedMessage) {
                return message.reply({
                    embeds: [createEmbed({
                        title: 'No Deleted Messages',
                        description: 'There are no recently deleted messages in this channel.',
                        type: 'warning'
                    })]
                });
            }

            const timeSinceDeleted = this.formatTimeDifference(
                deletedMessage.deletedAt, 
                new Date()
            );

            const snipeEmbed = createEmbed({
                title: 'Sniped Message',
                description: deletedMessage.content || '*No text content*',
                type: 'info',
                fields: [
                    { 
                        name: 'Author', 
                        value: `<@${deletedMessage.author.id}> (${deletedMessage.author.tag})`, 
                        inline: true 
                    },
                    { 
                        name: 'Deleted', 
                        value: `${timeSinceDeleted} ago`, 
                        inline: true 
                    }
                ]
            });

            snipeEmbed.setAuthor({
                name: deletedMessage.author.tag,
                iconURL: deletedMessage.author.avatarURL
            });

            snipeEmbed.setTimestamp(deletedMessage.createdAt);

            if (deletedMessage.attachments.length > 0) {
                snipeEmbed.addFields({
                    name: 'Attachments',
                    value: deletedMessage.attachments.map((url, i) => 
                        `[Attachment ${i+1}](${url})`
                    ).join(', ')
                });

                snipeEmbed.setImage(deletedMessage.attachments[0]);
            }

            message.reply({ embeds: [snipeEmbed] });
            
        } catch (error) {
            logger.error('Error in snipe command:', error);
            
            message.reply({
                embeds: [createEmbed({
                    title: 'Error',
                    description: 'An error occurred while retrieving the deleted message.',
                    type: 'error'
                })]
            });
        }
    },
    
    async executeSlash(interaction, client) {
        try {
            const deletedMessage = messageTracker.getDeletedMessage(interaction.channel.id);
            
            if (!deletedMessage) {
                return interaction.reply({
                    embeds: [createEmbed({
                        title: 'No Deleted Messages',
                        description: 'There are no recently deleted messages in this channel.',
                        type: 'warning'
                    })]
                });
            }

            const timeSinceDeleted = this.formatTimeDifference(
                deletedMessage.deletedAt, 
                new Date()
            );

            const snipeEmbed = createEmbed({
                title: 'Sniped Message',
                description: deletedMessage.content || '*No text content*',
                type: 'info',
                fields: [
                    { 
                        name: 'Author', 
                        value: `<@${deletedMessage.author.id}> (${deletedMessage.author.tag})`, 
                        inline: true 
                    },
                    { 
                        name: 'Deleted', 
                        value: `${timeSinceDeleted} ago`, 
                        inline: true 
                    }
                ]
            });

            snipeEmbed.setAuthor({
                name: deletedMessage.author.tag,
                iconURL: deletedMessage.author.avatarURL
            });

            snipeEmbed.setTimestamp(deletedMessage.createdAt);

            if (deletedMessage.attachments.length > 0) {
                snipeEmbed.addFields({
                    name: 'Attachments',
                    value: deletedMessage.attachments.map((url, i) => 
                        `[Attachment ${i+1}](${url})`
                    ).join(', ')
                });

                snipeEmbed.setImage(deletedMessage.attachments[0]);
            }

            interaction.reply({ embeds: [snipeEmbed] });
            
        } catch (error) {
            logger.error('Error in snipe slash command:', error);
            
            interaction.reply({
                embeds: [createEmbed({
                    title: 'Error',
                    description: 'An error occurred while retrieving the deleted message.',
                    type: 'error'
                })],
                ephemeral: true
            });
        }
    },
    
    /**
     * format the time difference between two dates
     * @param {Date} startDate The earlier date
     * @param {Date} endDate The later date
     * @returns {string} Formatted time difference
     */
    formatTimeDifference(startDate, endDate) {
        const diff = Math.abs(endDate - startDate) / 1000; 
        
        if (diff < 60) {
            return `${Math.round(diff)} second${Math.round(diff) !== 1 ? 's' : ''}`;
        } else if (diff < 3600) {
            const minutes = Math.floor(diff / 60);
            return `${minutes} minute${minutes !== 1 ? 's' : ''}`;
        } else if (diff < 86400) {
            const hours = Math.floor(diff / 3600);
            return `${hours} hour${hours !== 1 ? 's' : ''}`;
        } else {
            const days = Math.floor(diff / 86400);
            return `${days} day${days !== 1 ? 's' : ''}`;
        }
    }
};