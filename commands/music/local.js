// commands/music/local.js
const { SlashCommandBuilder } = require('discord.js');
const { createEmbed } = require('../../utils/embedBuilder');
const { joinVoiceChannel, createAudioPlayer, createAudioResource, AudioPlayerStatus, NoSubscriberBehavior } = require('@discordjs/voice');
const { createReadStream } = require('fs');
const logger = require('../../utils/logger');
const { exec } = require('child_process');

module.exports = {
    name: 'local',
    description: 'Play a local audio file',
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
                    title: 'Processing',
                    description: 'Generating test audio and preparing to play...',
                    type: 'info'
                })]
            });

            // Generate a test tone using FFmpeg
            exec('ffmpeg -f lavfi -i sine=frequency=440:duration=5 test_tone.mp3', async (error) => {
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

                    // Create an audio resource from the test tone
                    const resource = createAudioResource(createReadStream('test_tone.mp3'), {
                        inlineVolume: true
                    });
                    resource.volume.setVolume(0.5); // 50% volume

                    // Play the audio
                    player.play(resource);
                    connection.subscribe(player);

                    // Update message
                    loadingMsg.edit({
                        embeds: [createEmbed({
                            title: '🔊 Playing Test Audio',
                            description: 'Now playing a test tone. You should hear a beep sound.',
                            type: 'success'
                        })]
                    });

                    // Handle when audio finishes playing
                    player.on(AudioPlayerStatus.Idle, () => {
                        connection.destroy();
                        message.channel.send({
                            embeds: [createEmbed({
                                title: 'Test Complete',
                                description: 'Audio playback test completed.',
                                type: 'info'
                            })]
                        });
                    });

                    // Handle errors
                    player.on('error', err => {
                        logger.error('Player error:', err);
                        connection.destroy();
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