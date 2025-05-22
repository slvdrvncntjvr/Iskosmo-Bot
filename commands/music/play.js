const { SlashCommandBuilder } = require('discord.js');
const { createEmbed } = require('../../utils/embedBuilder');
const logger = require('../../utils/logger');
const musicPlayer = require('../../utils/musicPlayer');
const YouTube = require('youtube-sr').default;
// play-dl will be primarily used within musicPlayer.js, but importing here for clarity if direct use is needed.
// const playdl = require('play-dl');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('play')
        .setDescription('Plays a song from YouTube or adds it to the queue.')
        .addStringOption(option =>
            option.setName('query')
                .setDescription('YouTube URL or search query')
                .setRequired(true)),
    name: 'play',
    description: 'Plays a song from YouTube or adds it to the queue.',
    aliases: ['p'],
    args: true,
    usage: '<YouTube URL or search query>',
    guildOnly: true,
    voiceOnly: true, // Custom property to indicate command needs user in voice channel
    async executeSlash(interaction) {
        const { guild, member, channel: textChannel } = interaction;
        const voiceChannel = member.voice.channel;

        if (!voiceChannel) {
            const errorEmbed = createEmbed('Error', 'You need to be in a voice channel to use this command.');
            return interaction.reply({ embeds: [errorEmbed], ephemeral: true });
        }

        const query = interaction.options.getString('query');
        logger.info(`[PlayCommand ${guild.id}] Received slash command query: ${query}`);

        try {
            // Defer reply as searching and processing might take time
            await interaction.deferReply();

            // musicPlayer.handlePlayCommand will be implemented in musicPlayer.js
            // It will handle searching, enqueueing, joining, and playing.
            // It should also send feedback messages via the passed textChannel.
            await musicPlayer.handlePlayCommand(query, voiceChannel, textChannel, member.user.tag);

            // handlePlayCommand should manage its own feedback messages.
            // If it throws an error, it will be caught below.
            // No explicit success message here unless handlePlayCommand doesn't send one.

        } catch (error) {
            logger.error(`[PlayCommand ${guild.id}] Error executing play command (slash): ${error.message}`, error);
            const errorEmbed = createEmbed('Error', `An error occurred: ${error.message}`);
            if (interaction.deferred || interaction.replied) {
                await interaction.editReply({ embeds: [errorEmbed] });
            } else {
                await interaction.reply({ embeds: [errorEmbed], ephemeral: true });
            }
        }
    },
    async execute(message, args) {
        const { guild, member, channel: textChannel } = message;
        const voiceChannel = member.voice.channel;

        if (!voiceChannel) {
            const errorEmbed = createEmbed('Error', 'You need to be in a voice channel to use this command.');
            return message.reply({ embeds: [errorEmbed] });
        }

        if (args.length === 0) {
            const usageEmbed = createEmbed('Error', `Usage: ${message.client.prefix}${this.name} ${this.usage}`);
            return message.reply({ embeds: [usageEmbed] });
        }

        const query = args.join(' ');
        logger.info(`[PlayCommand ${guild.id}] Received prefix command query: ${query}`);

        try {
            // musicPlayer.handlePlayCommand will be implemented in musicPlayer.js
            await musicPlayer.handlePlayCommand(query, voiceChannel, textChannel, member.user.tag);

            // Feedback messages are handled by handlePlayCommand
        } catch (error) {
            logger.error(`[PlayCommand ${guild.id}] Error executing play command (prefix): ${error.message}`, error);
            const errorEmbed = createEmbed('Error', `An error occurred: ${error.message}`);
            await message.reply({ embeds: [errorEmbed] });
        }
    },
};
