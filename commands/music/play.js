// commands/music/ytplay.js
const { SlashCommandBuilder } = require('discord.js');
const { createEmbed } = require('../../utils/embedBuilder');
const { joinVoiceChannel, createAudioPlayer, createAudioResource, AudioPlayerStatus, NoSubscriberBehavior } = require('@discordjs/voice');
const ytdl = require('ytdl-core');
const { exec } = require('child_process');
const fs = require('fs');
const logger = require('../../utils/logger');

module.exports = {
    name: 'ytplay',
    description: 'Play a YouTube video using FFmpeg',
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

        try {
            // Validate URL
            if (!ytdl.validateURL(url)) {
                return message.reply({
                    embeds: [createEmbed({
                        title: 'Error',
                        description: 'Please provide a valid YouTube URL!',
                        type: 'error'
                    })]
                });
            }

            const loadingMsg = await message.reply({
                embeds: [createEmbed({
                    title: '🔍 Processing',
                    description: 'Fetching video information...',
                    type: 'info'
                })]
            });

            // Get video info
            const info = await ytdl.getInfo(url);
            const videoTitle = info.videoDetails.title;

            // Update message
            loadingMsg.edit({
                embeds: [createEmbed({
                    title: '⏳ Downloading',
                    description: `Preparing to play: ${videoTitle}`,
                    type: 'info'
                })]
            });

            // Using FFmpeg to download and process the audio
            // This is a two-step approach that might work better on resource-constrained devices
            const tempFile = `temp_${Date.now()}.mp3`;
            
            // Command to download audio using ytdl and FFmpeg
            const cmd = `ffmpeg -i "$(youtube-dl -f bestaudio -g ${url})" -acodec libmp3lame -ar 48000 -b:a 64k ${tempFile}`;
            
            // If you don't have youtube-dl, you can try this alternative with direct FFmpeg
            // const cmd = `ffmpeg -i "${url}" -vn -acodec libmp3lame -ar 48000 -b:a 64k ${tempFile}`;

            exec(cmd, async (error) => {
                if (error) {
                    logger.error('FFmpeg download error:', error);
                    return loadingMsg.edit({
                        embeds: [createEmbed({
                            title: 'Error',
                            description: `Failed to process video: ${error.message}`,
                            type: 'error'
                        })]
                    });
                }

                try {
                    // Join the voice channel
                    const connection = joinVoiceChannel({
                        channelId: message.member.voice.channel.id,
                        guildId: message.guild.id,
                        adapterCreator: message.guild.voiceAdapterCreator,
                    });

                    // Create an audio player
                    const player = createAudioPlayer({
                        behaviors: {
                            noSubscriber: NoSubscriberBehavior.Pause,
                        },
                    });

                    // Create an audio resource from the downloaded file
                    const resource = createAudioResource(fs.createReadStream(tempFile), {
                        inlineVolume: true
                    });
                    resource.volume.setVolume(0.5); // 50% volume

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
                    logger.error('Voice connection error:', err);
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