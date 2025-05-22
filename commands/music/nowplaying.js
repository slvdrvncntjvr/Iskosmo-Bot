const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { createEmbed } = require('../../utils/embedBuilder'); // Using this for consistency, but EmbedBuilder is fine too
const logger = require('../../utils/logger');
const musicPlayer = require('../../utils/musicPlayer');

// Helper to format duration from ms to mm:ss
function formatDuration(ms) {
    if (!ms || ms < 0) ms = 0;
    const totalSeconds = Math.floor(ms / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
}

// Helper to create a simple text progress bar
function createProgressBar(currentMs, totalMs, barLength = 20) {
    if (!totalMs || totalMs <= 0) return 'N/A';
    const progress = Math.min(Math.max(currentMs / totalMs, 0), 1);
    const filledLength = Math.round(progress * barLength);
    const emptyLength = barLength - filledLength;
    return '`[' + '▬'.repeat(filledLength) + '🔘' + '▬'.repeat(emptyLength) + ']`';
}


module.exports = {
    data: new SlashCommandBuilder()
        .setName('nowplaying')
        .setDescription('Shows details about the currently playing song.'),
    name: 'nowplaying',
    description: 'Shows details about the currently playing song.',
    aliases: ['np', 'current'],
    guildOnly: true,
    async executeSlash(interaction) {
        const { guild } = interaction;
        if (!guild) {
            const errorEmbed = createEmbed('Error', 'This command can only be used in a server.');
            return interaction.reply({ embeds: [errorEmbed], ephemeral: true });
        }

        try {
            const nowPlayingData = musicPlayer.getNowPlaying(guild.id);

            if (nowPlayingData && nowPlayingData.title) {
                const song = nowPlayingData;
                const totalDurationMs = song.duration * 1000; // Assuming song.duration is in seconds
                const currentPlaybackMs = song.playbackDuration || 0;

                const progressBar = createProgressBar(currentPlaybackMs, totalDurationMs);
                const durationDisplay = `${formatDuration(currentPlaybackMs)} / ${formatDuration(totalDurationMs)}`;

                const nowPlayingEmbed = new EmbedBuilder()
                    .setColor(0x0099FF)
                    .setTitle(`▶️ Now Playing: ${song.title}`)
                    .setURL(song.url)
                    .addFields(
                        { name: 'Requested by', value: song.requestedBy || 'Unknown', inline: true },
                        { name: 'Duration', value: `${durationDisplay}\n${progressBar}`, inline: true }
                    )
                    .setTimestamp();
                
                if (song.thumbnail) {
                    nowPlayingEmbed.setThumbnail(song.thumbnail);
                }
                
                await interaction.reply({ embeds: [nowPlayingEmbed] });

            } else {
                const noSongEmbed = createEmbed('Nothing Playing', 'Nothing is currently playing in this server.');
                await interaction.reply({ embeds: [noSongEmbed] });
            }

        } catch (error) {
            logger.error(`[NowPlayingCommand ${guild?.id}] Error executing nowplaying command (slash): ${error.message}`, error);
            const errorEmbed = createEmbed('Error', `An error occurred: ${error.message}`);
            if (interaction.replied || interaction.deferred) {
                await interaction.editReply({ embeds: [errorEmbed] });
            } else {
                await interaction.reply({ embeds: [errorEmbed], ephemeral: true });
            }
        }
    },
    async execute(message, args) {
        const { guild } = message;
        if (!guild) {
            const errorEmbed = createEmbed('Error', 'This command can only be used in a server.');
            return message.channel.send({ embeds: [errorEmbed] });
        }

        try {
            const nowPlayingData = musicPlayer.getNowPlaying(guild.id);

            if (nowPlayingData && nowPlayingData.title) {
                const song = nowPlayingData;
                const totalDurationMs = song.duration * 1000; // song.duration is in seconds
                const currentPlaybackMs = song.playbackDuration || 0;
                
                const progressBar = createProgressBar(currentPlaybackMs, totalDurationMs);
                const durationDisplay = `${formatDuration(currentPlaybackMs)} / ${formatDuration(totalDurationMs)}`;

                const nowPlayingEmbed = new EmbedBuilder()
                    .setColor(0x0099FF)
                    .setTitle(`▶️ Now Playing: ${song.title}`)
                    .setURL(song.url)
                    .addFields(
                        { name: 'Requested by', value: song.requestedBy || 'Unknown', inline: true },
                        { name: 'Duration', value: `${durationDisplay}\n${progressBar}`, inline: true }
                    )
                    .setTimestamp();

                if (song.thumbnail) {
                    nowPlayingEmbed.setThumbnail(song.thumbnail);
                }
                
                await message.channel.send({ embeds: [nowPlayingEmbed] });

            } else {
                const noSongEmbed = createEmbed('Nothing Playing', 'Nothing is currently playing in this server.');
                await message.channel.send({ embeds: [noSongEmbed] });
            }
        } catch (error) {
            logger.error(`[NowPlayingCommand ${guild?.id}] Error executing nowplaying command (prefix): ${error.message}`, error);
            const errorEmbed = createEmbed('Error', `An error occurred: ${error.message}`);
            await message.channel.send({ embeds: [errorEmbed] });
        }
    },
};
