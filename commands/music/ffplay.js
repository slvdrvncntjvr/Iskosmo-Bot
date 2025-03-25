const { SlashCommandBuilder } = require('discord.js');
const { createEmbed } = require('../../utils/embedBuilder');
const { joinVoiceChannel, createAudioPlayer, createAudioResource, AudioPlayerStatus } = require('@discordjs/voice');
const { exec } = require('child_process');
const fs = require('fs');
const logger = require('../../utils/logger');
const path = require('path');

module.exports = {
    name: 'ffplay',
    description: 'Play audio using FFmpeg directly',
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

        try {
            const loadingMsg = await message.reply({
                embeds: [createEmbed({
                    title: '⏳ Processing',
                    description: 'Generating test audio...',
                    type: 'info'
                })]
            });

            // Create a unique filename
            const tempFile = path.join(__dirname, `../../temp_${Date.now()}.mp3`);

            // Generate a test tone directly
            const command = `ffmpeg -f lavfi -i sine=frequency=440:duration=10 -acodec libmp3lame "${tempFile}"`;
            
            exec(command, async (error, stdout, stderr) => {
                if (error) {
                    logger.error('FFmpeg error:', error);
                    return loadingMsg.edit({
                        embeds: [createEmbed({
                            title: 'Error',
                            description: `Failed to generate audio: ${error.message}`,
                            type: 'error'
                        })]
                    });
                }

                try {
                    // Check if the file exists
                    if (!fs.existsSync(tempFile)) {
                        return loadingMsg.edit({
                            embeds: [createEmbed({
                                title: 'Error',
                                description: 'Failed to create audio file',
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

                    // Create an audio resource from the file
                    const resource = createAudioResource(fs.createReadStream(tempFile));

                    // Play the audio
                    player.play(resource);
                    connection.subscribe(player);

                    // Update message
                    loadingMsg.edit({
                        embeds: [createEmbed({
                            title: '🔊 Test Audio',
                            description: 'Now playing a test tone. You should hear a beep sound.',
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
                                title: 'Test Complete',
                                description: 'Audio test finished.',
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
                    // Delete the temporary file if it exists
                    if (fs.existsSync(tempFile)) {
                        fs.unlink(tempFile, (unlinkErr) => {
                            if (unlinkErr) logger.error('Error deleting temp file:', unlinkErr);
                        });
                    }
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