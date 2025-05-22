const { SlashCommandBuilder } = require('discord.js');
const { createEmbed } = require('../../utils/embedBuilder');
const logger = require('../../utils/logger');
const musicPlayer = require('../../utils/musicPlayer');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('leave')
        .setDescription('Makes the bot leave the current voice channel and clears the queue.'),
    name: 'leave',
    description: 'Makes the bot leave the current voice channel and clears the queue.',
    aliases: ['disconnect'], // 'stop' is a more comprehensive command, leave is just for disconnecting
    guildOnly: true,
    async executeSlash(interaction) {
        const { guild, member } = interaction;
        const voiceChannel = member.voice.channel;

        if (!voiceChannel) {
            const errorEmbed = createEmbed('Error', 'You need to be in a voice channel to use this command.');
            return interaction.reply({ embeds: [errorEmbed], ephemeral: true });
        }

        const playerInstance = musicPlayer.getGuildPlayer(guild.id);

        if (!playerInstance || !playerInstance.connection) {
            const errorEmbed = createEmbed('Bot Not Connected', 'I am not currently in a voice channel in this server.');
            return interaction.reply({ embeds: [errorEmbed], ephemeral: true });
        }

        // Optional: Check if user is in the same voice channel as the bot
        // if (playerInstance.connection.joinConfig.channelId !== voiceChannel.id) {
        //     const errorEmbed = createEmbed('Error', 'You must be in the same voice channel as me to use this command.');
        //     return interaction.reply({ embeds: [errorEmbed], ephemeral: true });
        // }

        try {
            // musicPlayer.leave will internally call musicPlayer.stop
            const result = musicPlayer.leave(guild.id); 

            if (result && result.left) {
                const successEmbed = createEmbed('Disconnected', '👋 Successfully disconnected from the voice channel and cleared the queue.');
                await interaction.reply({ embeds: [successEmbed] });
            } else {
                // This might occur if playerInstance existed but leave failed.
                const errorEmbed = createEmbed('Error', result.reason || 'Could not leave the voice channel. I might not have been connected properly.');
                await interaction.reply({ embeds: [errorEmbed], ephemeral: true });
            }
        } catch (error) {
            logger.error(`[LeaveCommand ${guild.id}] Error executing leave command (slash): ${error.message}`, error);
            const errorEmbed = createEmbed('Error', `An error occurred: ${error.message}`);
            if (interaction.replied || interaction.deferred) {
                await interaction.editReply({ embeds: [errorEmbed] });
            } else {
                await interaction.reply({ embeds: [errorEmbed], ephemeral: true });
            }
        }
    },
    async execute(message, args) {
        const { guild, member } = message;
        const voiceChannel = member.voice.channel;

        if (!voiceChannel) {
            const errorEmbed = createEmbed('Error', 'You need to be in a voice channel to use this command.');
            return message.reply({ embeds: [errorEmbed] });
        }

        const playerInstance = musicPlayer.getGuildPlayer(guild.id);

        if (!playerInstance || !playerInstance.connection) {
            const errorEmbed = createEmbed('Bot Not Connected', 'I am not currently in a voice channel in this server.');
            return message.reply({ embeds: [errorEmbed] });
        }

        // Optional: Check if user is in the same voice channel
        // if (playerInstance.connection.joinConfig.channelId !== voiceChannel.id) {
        //     const errorEmbed = createEmbed('Error', 'You must be in the same voice channel as me to use this command.');
        //     return message.reply({ embeds: [errorEmbed] });
        // }
        
        try {
            const result = musicPlayer.leave(guild.id);

            if (result && result.left) {
                const successEmbed = createEmbed('Disconnected', '👋 Successfully disconnected from the voice channel and cleared the queue.');
                await message.reply({ embeds: [successEmbed] });
            } else {
                const errorEmbed = createEmbed('Error', result.reason || 'Could not leave the voice channel. I might not have been connected properly.');
                await message.reply({ embeds: [errorEmbed] });
            }
        } catch (error) {
            logger.error(`[LeaveCommand ${guild.id}] Error executing leave command (prefix): ${error.message}`, error);
            const errorEmbed = createEmbed('Error', `An error occurred: ${error.message}`);
            await message.reply({ embeds: [errorEmbed] });
        }
    },
};
