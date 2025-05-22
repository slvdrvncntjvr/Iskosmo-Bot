const { SlashCommandBuilder } = require('discord.js');
const { createEmbed } = require('../../utils/embedBuilder');
const logger = require('../../utils/logger');
const musicPlayer = require('../../utils/musicPlayer');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('skip')
        .setDescription('Skips the current song.'),
    name: 'skip',
    description: 'Skips the current song.',
    aliases: ['s'],
    guildOnly: true,
    voiceOnly: true, // Ensures user is in a voice channel
    async executeSlash(interaction) {
        const { guild, member } = interaction;
        // voiceOnly property should ensure member.voice.channel exists
        // const voiceChannel = member.voice.channel;

        // Ensure player text channel is updated to the interaction channel for this command
        const player = musicPlayer._ensurePlayer(guild.id, interaction.channel);
        if (player && player.textChannel?.id !== interaction.channel?.id) {
            logger.info(`[SkipCommand ${guild.id}] Updated player text channel to ${interaction.channel?.name}`);
            player.textChannel = interaction.channel;
        }
        
        // Defer reply as musicPlayer.skip might take a moment and sends its own messages.
        // However, the command itself should provide the primary success/failure of the skip *action*.
        // await interaction.deferReply({ ephemeral: true }); // ephemeral if only user needs to see it

        const result = musicPlayer.skip(guild.id);

        if (result.skipped) {
            // musicPlayer.skip already sends a "Skipped <song>" message.
            // The interaction still needs a reply.
            // We can send a simple confirmation here, or make musicPlayer.skip NOT send messages.
            // For consistency, let's have the command send the reply.
            // I will modify musicPlayer.skip to NOT send the "Skipped X" message,
            // but let its event handlers send "Now playing Y" or "Queue empty".
            const successEmbed = createEmbed('Song Skipped', `⏭️ Skipped **${result.songTitle}**.`);
            // The musicPlayer's 'Idle' event will announce the next song or queue end.
            return interaction.reply({ embeds: [successEmbed] });
        } else {
            const errorEmbed = createEmbed('Nothing to Skip', result.reason || 'There is no song currently playing to skip.');
            return interaction.reply({ embeds: [errorEmbed], ephemeral: true });
        }
    },
    async execute(message, args) {
        const { guild, member } = message;
        // const voiceChannel = member.voice.channel; // Already checked by voiceOnly

        // Ensure player text channel is updated
        const player = musicPlayer._ensurePlayer(guild.id, message.channel);
         if (player && player.textChannel?.id !== message.channel?.id) {
            logger.info(`[SkipCommand ${guild.id}] Updated player text channel to ${message.channel?.name}`);
            player.textChannel = message.channel;
        }

        const result = musicPlayer.skip(guild.id);

        if (result.skipped) {
            const successEmbed = createEmbed('Song Skipped', `⏭️ Skipped **${result.songTitle}**.`);
            // musicPlayer's 'Idle' event handles next song announcement or queue end.
            return message.reply({ embeds: [successEmbed] });
        } else {
            const errorEmbed = createEmbed('Nothing to Skip', result.reason || 'There is no song currently playing to skip.');
            return message.reply({ embeds: [errorEmbed] });
        }
    },
};
