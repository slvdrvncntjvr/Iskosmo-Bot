const { SlashCommandBuilder, EmbedBuilder } = require('discord.js'); // EmbedBuilder for more direct control if needed, though createEmbed is primary
const { createEmbed } = require('../../utils/embedBuilder');
const logger = require('../../utils/logger');
const musicPlayer = require('../../utils/musicPlayer');

const MAX_QUEUE_DISPLAY = 10; // Show current + next 9

module.exports = {
    data: new SlashCommandBuilder()
        .setName('queue')
        .setDescription('Displays the current song queue.'),
    name: 'queue',
    description: 'Displays the current song queue.',
    aliases: ['q'],
    guildOnly: true,
    async executeSlash(interaction) {
        const { guild } = interaction;
        if (!guild) {
            const errorEmbed = createEmbed('Error', 'This command can only be used in a server.');
            return interaction.reply({ embeds: [errorEmbed], ephemeral: true });
        }

        try {
            // await interaction.deferReply(); // Defer if queue processing is expected to be long

            const queueData = musicPlayer.getQueue(guild.id);

            if (!queueData || (!queueData.nowPlaying && queueData.upcoming.length === 0)) {
                const emptyQueueEmbed = createEmbed('Queue Empty', 'The queue is currently empty and nothing is playing.');
                return interaction.reply({ embeds: [emptyQueueEmbed] });
            }

            const embed = new EmbedBuilder()
                .setColor(0x0099FF) // Or your preferred color
                .setTitle('🎵 Music Queue 🎵')
                .setTimestamp();

            if (queueData.nowPlaying) {
                embed.addFields({ 
                    name: '▶️ Now Playing', 
                    value: `**[${queueData.nowPlaying.title}](${queueData.nowPlaying.url})**\nDuration: ${queueData.nowPlaying.durationFormatted}\nRequested by: ${queueData.nowPlaying.requestedBy}`,
                    inline: false 
                });
            } else {
                embed.addFields({ name: '▶️ Now Playing', value: 'Nothing is currently playing.', inline: false });
            }

            if (queueData.upcoming.length > 0) {
                const upcomingSongs = queueData.upcoming.slice(0, MAX_QUEUE_DISPLAY).map((song, index) => {
                    return `${index + 1}. **[${song.title}](${song.url})**\n   Duration: ${song.durationFormatted} | Requested by: ${song.requestedBy}`;
                }).join('\n\n');
                
                embed.addFields({ name: `🎶 Up Next (Top ${Math.min(queueData.upcoming.length, MAX_QUEUE_DISPLAY)})`, value: upcomingSongs || 'No songs up next.', inline: false });

                if (queueData.upcoming.length > MAX_QUEUE_DISPLAY) {
                    embed.setFooter({ text: `...and ${queueData.upcoming.length - MAX_QUEUE_DISPLAY} more song(s).` });
                }
            } else {
                embed.addFields({ name: '🎶 Up Next', value: 'No songs up next.', inline: false });
            }
            
            // Set a thumbnail if available (e.g., from current song or a default one)
            if (queueData.nowPlaying && queueData.nowPlaying.thumbnail) {
                embed.setThumbnail(queueData.nowPlaying.thumbnail);
            } else if (queueData.upcoming.length > 0 && queueData.upcoming[0].thumbnail) {
                 embed.setThumbnail(queueData.upcoming[0].thumbnail);
            }


            await interaction.reply({ embeds: [embed] });

        } catch (error) {
            logger.error(`[QueueCommand ${guild?.id}] Error executing queue command (slash): ${error.message}`, error);
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
            // Should be caught by guildOnly but good practice
            const errorEmbed = createEmbed('Error', 'This command can only be used in a server.');
            return message.channel.send({ embeds: [errorEmbed] });
        }

        try {
            const queueData = musicPlayer.getQueue(guild.id);

            if (!queueData || (!queueData.nowPlaying && queueData.upcoming.length === 0)) {
                const emptyQueueEmbed = createEmbed('Queue Empty', 'The queue is currently empty and nothing is playing.');
                return message.channel.send({ embeds: [emptyQueueEmbed] });
            }

            const embed = new EmbedBuilder()
                .setColor(0x0099FF)
                .setTitle('🎵 Music Queue 🎵')
                .setTimestamp();

            if (queueData.nowPlaying) {
                embed.addFields({ 
                    name: '▶️ Now Playing', 
                    value: `**[${queueData.nowPlaying.title}](${queueData.nowPlaying.url})**\nDuration: ${queueData.nowPlaying.durationFormatted}\nRequested by: ${queueData.nowPlaying.requestedBy}`,
                    inline: false 
                });
            } else {
                 embed.addFields({ name: '▶️ Now Playing', value: 'Nothing is currently playing.', inline: false });
            }

            if (queueData.upcoming.length > 0) {
                const upcomingSongs = queueData.upcoming.slice(0, MAX_QUEUE_DISPLAY).map((song, index) => {
                    return `${index + 1}. **[${song.title}](${song.url})**\n   Duration: ${song.durationFormatted} | Requested by: ${song.requestedBy}`;
                }).join('\n\n');
                
                embed.addFields({ name: `🎶 Up Next (Top ${Math.min(queueData.upcoming.length, MAX_QUEUE_DISPLAY)})`, value: upcomingSongs || 'No songs up next.', inline: false });

                if (queueData.upcoming.length > MAX_QUEUE_DISPLAY) {
                    embed.setFooter({ text: `...and ${queueData.upcoming.length - MAX_QUEUE_DISPLAY} more song(s).` });
                }
            } else {
                embed.addFields({ name: '🎶 Up Next', value: 'No songs up next.', inline: false });
            }
            
            if (queueData.nowPlaying && queueData.nowPlaying.thumbnail) {
                embed.setThumbnail(queueData.nowPlaying.thumbnail);
            } else if (queueData.upcoming.length > 0 && queueData.upcoming[0].thumbnail) {
                 embed.setThumbnail(queueData.upcoming[0].thumbnail);
            }

            await message.channel.send({ embeds: [embed] });

        } catch (error) {
            logger.error(`[QueueCommand ${guild?.id}] Error executing queue command (prefix): ${error.message}`, error);
            const errorEmbed = createEmbed('Error', `An error occurred: ${error.message}`);
            await message.channel.send({ embeds: [errorEmbed] });
        }
    },
};
