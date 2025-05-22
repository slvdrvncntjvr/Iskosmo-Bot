const { SlashCommandBuilder } = require('discord.js');
const { createEmbed } = require('../../utils/embedBuilder');
const logger = require('../../utils/logger');
const musicPlayer = require('../../utils/musicPlayer');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('stop')
        .setDescription('Stops playback, clears the queue, and disconnects the bot.'),
    name: 'stop',
    description: 'Stops playback, clears the queue, and disconnects the bot.',
    aliases: ['st'], // Short alias for stop
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
            const errorEmbed = createEmbed('Bot Not Connected', 'The bot is not currently in a voice channel in this server.');
            return interaction.reply({ embeds: [errorEmbed], ephemeral: true });
        }
        
        // Ensure the user is in the same voice channel as the bot, or has permissions to stop
        // For simplicity, we'll only check if bot is connected. Admin/DJ role checks would be an enhancement.
        // if (playerInstance.connection.joinConfig.channelId !== voiceChannel.id) {
        //     const errorEmbed = createEmbed('Error', 'You must be in the same voice channel as the bot to stop playback.');
        //     return interaction.reply({ embeds: [errorEmbed], ephemeral: true });
        // }

        try {
            // musicPlayer.stop(guild.id) will handle the actual stopping, clearing, and leaving.
            // It should also clean up the player instance from the map.
            const result = musicPlayer.stop(guild.id); // Assuming stop might return a status or confirmation

            if (result && result.stopped) { // Check if musicPlayer.stop indicates success
                const successEmbed = createEmbed('Playback Stopped', '⏹️ Playback has been stopped, the queue is cleared, and I have left the voice channel.');
                await interaction.reply({ embeds: [successEmbed] });
            } else {
                // This case might occur if player was found but stop operation failed internally,
                // or if stop returns a more detailed status.
                // For now, the earlier check for playerInstance.connection should cover most "not connected" cases.
                const errorEmbed = createEmbed('Error', 'Could not stop playback. The bot might not have been playing or an error occurred.');
                await interaction.reply({ embeds: [errorEmbed], ephemeral: true });
            }
        } catch (error) {
            logger.error(`[StopCommand ${guild.id}] Error executing stop command (slash): ${error.message}`, error);
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
            const errorEmbed = createEmbed('Bot Not Connected', 'The bot is not currently in a voice channel in this server.');
            return message.reply({ embeds: [errorEmbed] });
        }

        // if (playerInstance.connection.joinConfig.channelId !== voiceChannel.id) {
        //     const errorEmbed = createEmbed('Error', 'You must be in the same voice channel as the bot to stop playback.');
        //     return message.reply({ embeds: [errorEmbed] });
        // }

        try {
            const result = musicPlayer.stop(guild.id);

            if (result && result.stopped) {
                const successEmbed = createEmbed('Playback Stopped', '⏹️ Playback has been stopped, the queue is cleared, and I have left the voice channel.');
                await message.reply({ embeds: [successEmbed] });
            } else {
                const errorEmbed = createEmbed('Error', 'Could not stop playback. The bot might not have been playing or an error occurred.');
                await message.reply({ embeds: [errorEmbed] });
            }
        } catch (error) {
            logger.error(`[StopCommand ${guild.id}] Error executing stop command (prefix): ${error.message}`, error);
            const errorEmbed = createEmbed('Error', `An error occurred: ${error.message}`);
            await message.reply({ embeds: [errorEmbed] });
        }
    },
};
