const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const { createEmbed } = require('../../utils/embedBuilder');
const logger = require('../../utils/logger');

module.exports = {
    name: 'purge',
    description: 'Delete multiple messages at once',
    usage: '[count] [user mention (optional)]',
    category: 'moderation',
    guildOnly: true,
    permissions: [PermissionFlagsBits.ManageMessages],
    
    slashCommand: new SlashCommandBuilder()
        .setName('purge')
        .setDescription('Delete multiple messages at once')
        .addIntegerOption(option => 
            option.setName('count')
                .setDescription('Number of messages to delete (1-100)')
                .setMinValue(1)
                .setMaxValue(100)
                .setRequired(true))
        .addUserOption(option => 
            option.setName('target')
                .setDescription('Only delete messages from this user')
                .setRequired(false))
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages),
    
    async execute(message, args, client) {
        if (!args.length) {
            return message.reply({ 
                embeds: [createEmbed({
                    title: 'Command Error',
                    description: 'You need to specify how many messages to delete.',
                    type: 'error'
                })]
            });
        }
        
        const count = parseInt(args[0]);
        if (isNaN(count) || count < 1 || count > 100) {
            return message.reply({ 
                embeds: [createEmbed({
                    title: 'Command Error',
                    description: 'Please provide a number between 1 and 100.',
                    type: 'error'
                })]
            });
        }
        
        const target = message.mentions.users.first();
        
        try {
            // Delete the command message first
            await message.delete();
            
            // Get messages to delete
            const fetchedMessages = await message.channel.messages.fetch({ limit: 100 });
            
            let messagesToDelete;
            
            if (target) {
                // Filter for messages from the target user
                messagesToDelete = fetchedMessages
                    .filter(m => m.author.id === target.id)
                    .first(count);
            } else {
                // No target specified, just get the count
                messagesToDelete = fetchedMessages.first(count);
            }
            
            // Bulk delete messages that are less than 14 days old
            const recentMessages = messagesToDelete.filter(m => {
                return (Date.now() - m.createdTimestamp) < 1209600000; // 14 days in milliseconds
            });
            
            if (recentMessages.length === 0) {
                return message.channel.send({ 
                    embeds: [createEmbed({
                        title: 'Error',
                        description: 'No messages found that can be deleted (messages must be less than 14 days old).',
                        type: 'error'
                    })]
                });
            }

            const deleted = await message.channel.bulkDelete(recentMessages, true);
            
            // Send confirmation message that will delete itself after 5 seconds
            const confirmMessage = await message.channel.send({ 
                embeds: [createEmbed({
                    title: 'Messages Purged',
                    description: `Successfully deleted ${deleted.size} message(s)${target ? ` from ${target.tag}` : ''}.`,
                    type: 'success'
                })]
            });
            
            setTimeout(() => {
                confirmMessage.delete().catch(e => logger.error('Error deleting purge confirmation message:', e));
            }, 5000);
            
            logger.info(`${message.author.tag} purged ${deleted.size} messages${target ? ` from ${target.tag}` : ''} in #${message.channel.name}`);
            logger.logToDiscord(client, `${message.author.tag} purged ${deleted.size} messages${target ? ` from ${target.tag}` : ''} in #${message.channel.name} (${message.guild.name})`);
            
        } catch (error) {
            logger.error('Error purging messages:', error);
            
            message.channel.send({ 
                embeds: [createEmbed({
                    title: 'Command Error',
                    description: `Failed to purge messages: ${error.message}`,
                    type: 'error'
                })]
            });
        }
    },
    
    async executeSlash(interaction, client) {
        const count = interaction.options.getInteger('count');
        const target = interaction.options.getUser('target');
        
        try {
            // Defer reply as ephemeral since we'll send a custom message after
            await interaction.deferReply({ ephemeral: true });
            
            // Get messages to delete
            const fetchedMessages = await interaction.channel.messages.fetch({ limit: 100 });
            
            let messagesToDelete;
            
            if (target) {
                // Filter for messages from the target user
                messagesToDelete = fetchedMessages
                    .filter(m => m.author.id === target.id)
                    .first(count);
            } else {
                // No target specified, just get the count
                messagesToDelete = fetchedMessages.first(count);
            }
            
            // Bulk delete messages that are less than 14 days old
            const recentMessages = messagesToDelete.filter(m => {
                return (Date.now() - m.createdTimestamp) < 1209600000; // 14 days in milliseconds
            });
            
            if (recentMessages.length === 0) {
                return interaction.editReply({ 
                    embeds: [createEmbed({
                        title: 'Error',
                        description: 'No messages found that can be deleted (messages must be less than 14 days old).',
                        type: 'error'
                    })]
                });
            }

            const deleted = await interaction.channel.bulkDelete(recentMessages, true);
            
            // Send confirmation to the user
            await interaction.editReply({ 
                embeds: [createEmbed({
                    title: 'Messages Purged',
                    description: `Successfully deleted ${deleted.size} message(s)${target ? ` from ${target.tag}` : ''}.`,
                    type: 'success'
                })]
            });
            
            // Send a temporary channel message that will delete itself
            const confirmMessage = await interaction.channel.send({ 
                embeds: [createEmbed({
                    title: 'Messages Purged',
                    description: `${interaction.user.tag} deleted ${deleted.size} message(s)${target ? ` from ${target.tag}` : ''}.`,
                    type: 'success'
                })]
            });
            
            setTimeout(() => {
                confirmMessage.delete().catch(e => logger.error('Error deleting purge confirmation message:', e));
            }, 5000);
            
            logger.info(`${interaction.user.tag} purged ${deleted.size} messages${target ? ` from ${target.tag}` : ''} in #${interaction.channel.name}`);
            logger.logToDiscord(client, `${interaction.user.tag} purged ${deleted.size} messages${target ? ` from ${target.tag}` : ''} in #${interaction.channel.name} (${interaction.guild.name})`);
            
        } catch (error) {
            logger.error('Error purging messages:', error);
            
            if (interaction.deferred || interaction.replied) {
                interaction.editReply({ 
                    embeds: [createEmbed({
                        title: 'Command Error',
                        description: `Failed to purge messages: ${error.message}`,
                        type: 'error'
                    })]
                });
            } else {
                interaction.reply({ 
                    embeds: [createEmbed({
                        title: 'Command Error',
                        description: `Failed to purge messages: ${error.message}`,
                        type: 'error'
                    })],
                    ephemeral: true
                });
            }
        }
    }
};