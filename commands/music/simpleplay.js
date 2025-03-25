const { SlashCommandBuilder } = require('discord.js');
const { createEmbed } = require('../../utils/embedBuilder');
const { joinVoiceChannel, createAudioPlayer, createAudioResource, AudioPlayerStatus } = require('@discordjs/voice');
const { exec } = require('child_process');
const fs = require('fs');
const logger = require('../../utils/logger');
const path = require('path');

module.exports = {
    name: 'simpleplay',
    description: 'Play a YouTube video (simplified method)',
    usage: '<YouTube URL>',
    category: 'music',
    guildOnly: true,

    async execute(message, args, client) {
        // Check if the user is in a voice channel
        if (!message.member.voice.channel) {
            return message.reply({
                embeds: [createEmbed({
                    title: 'Error',
                    description: 'You need to be in a voice channel!',
                    type: 'error'
                })]
            });
        }

        // Check if a URL was provided
        if (!args.length) {
            return message.reply({
                embeds: [createEmbed({
                    title: 'Error',
                    description: 'Please provide a YouTube URL!',
                    type: 'error'
                })]
            });
        }

        const url = args[0];
        
        // Verify it's a YouTube URL
        if (!url.includes('youtube.com') && !url.includes('youtu.be')) {
            return message.reply({
                embeds: [createEmbed({
                    title: 'Error',
                    description: 'Please provide a valid YouTube URL!',
                    type: 'error'
                })]
            });
        }

        try {
            const loadingMsg = await message.reply({
                embeds: [createEmbed({
                    title: '⏳ Processing',
                    description: 'Downloading audio from YouTube...',
                    type: 'info'
                })]
            });

            // Create a unique filename to avoid conflicts
            const tempFile = path.join(__dirname, `../../temp_${Date.now()}.mp3`);

            // Use youtube-dl to download audio directly
            const command = `youtube-dl -x --audio-format mp3 --audio-quality 128K -o "${tempFile}" ${url}`;
            
            exec(command, async (error, stdout, stderr) => {
                if (error) {
                    logger.error('Download error:', error);
                    return loadingMsg.edit({
                        embeds: [createEmbed({
                            title: 'Error',
                            description: `Failed to download audio: ${error.message}`,
                            type: 'error'
                        })]
                    });
                }

                // Get video title from youtube-dl output
                let videoTitle = 'YouTube Video';
                try {
                    exec(`youtube-dl --get-title ${url}`, (err, title) => {
                        if (!err && title) {
                            videoTitle = title.trim();
                        }
                    });
                } catch (e) {
                    logger.error('Error getting title:', e);
                }

                try {
                    // Check if the file exists
                    if (!fs.existsSync(tempFile)) {
                        return loadingMsg.edit({
                            embeds: [createEmbed({
                                title: 'Error',
                                description: 'Failed to download audio file',
                                type: 'error'
                            })]
                        });
                    }

                    // Join the voice channel
                    const connection = joinVoiceChannel({
                        channelId: message.member.voice.channel.id,
                        guildId: message.guild.id,
                        adapterCreator: message.guild.voiceAdapterCreator,
                    });

                    // Create an audio player
                    const player = createAudioPlayer();

                    // Create an audio resource from the downloaded file
                    const resource = createAudioResource(fs.createReadStream(tempFile));

                    // Play the audio
                    player.play(resource);
                    connection.subscribe(player);

                    // Update message
                    loadingMsg.edit({
                        embeds: [createEmbed({
                            title: '🎵 Now Playing',
                            description: `Now playing: ${videoTitle}`,
                            type: 'success'
                        })]
                    });

                    // Handle when audio finishes playing
                    player.on(AudioPlayerStatus.Idle, () => {
                        connection.destroy();
                        // Delete the temporary file
                        fs.unlink(tempFile, (err) => {
                            if (err) logger.error('Error deleting temp file:', err);
                        });
                        message.channel.send({
                            embeds: [createEmbed({
                                title: 'Playback Complete',
                                description: `Finished playing: ${videoTitle}`,
                                type: 'info'
                            })]
                        });
                    });

                    // Handle errors
                    player.on('error', err => {
                        logger.error('Player error:', err);
                        connection.destroy();
                        // Delete the temporary file
                        fs.unlink(tempFile, (unlinkErr) => {
                            if (unlinkErr) logger.error('Error deleting temp file:', unlinkErr);
                        });
                        message.channel.send({
                            embeds: [createEmbed({
                                title: 'Playback Error',
                                description: `An error occurred during playback: ${err.message}`,
                                type: 'error'
                            })]
                        });
                    });

                } catch (err) {
                    logger.error('Playback error:', err);
                    // Delete the temporary file
                    fs.unlink(tempFile, (unlinkErr) => {
                        if (unlinkErr) logger.error('Error deleting temp file:', unlinkErr);
                    });
                    loadingMsg.edit({
                        embeds: [createEmbed({
                            title: 'Error',
                            description: `Failed to play audio: ${err.message}`,
                            type: 'error'
                        })]
                    });
                }
            });
        } catch (error) {
            logger.error('Command error:', error);
            message.reply({
                embeds: [createEmbed({
                    title: 'Error',
                    description: `An error occurred: ${error.message}`,
                    type: 'error'
                })]
            });
        }
    }
};