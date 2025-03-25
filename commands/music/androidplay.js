// commands/music/androidplay.js
const { SlashCommandBuilder } = require('discord.js');
const { createEmbed } = require('../../utils/embedBuilder');
const { exec } = require('child_process');
const logger = require('../../utils/logger');

module.exports = {
    name: 'androidplay',
    description: 'Play a sound using Android native player',
    category: 'music',
    
    async execute(message, args, client) {
        try {
            const loadingMsg = await message.reply({
                embeds: [createEmbed({
                    title: 'Processing',
                    description: 'Generating test audio and attempting to play via Android...',
                    type: 'info'
                })]
            });
            
            // Generate a test tone
            exec('ffmpeg -f lavfi -i sine=frequency=440:duration=5 /data/data/com.termux/files/home/test_tone.mp3', (error) => {
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
                
                // Try to play using termux-media-player
                exec('termux-media-player play /data/data/com.termux/files/home/test_tone.mp3', (playError) => {
                    if (playError) {
                        logger.error('Media player error:', playError);
                        return loadingMsg.edit({
                            embeds: [createEmbed({
                                title: 'Error',
                                description: `Failed to play audio via Android: ${playError.message}`,
                                type: 'error'
                            })]
                        });
                    }
                    
                    loadingMsg.edit({
                        embeds: [createEmbed({
                            title: '🔊 Playing via Android',
                            description: 'A test tone should be playing through your device speakers.',
                            type: 'success'
                        })]
                    });
                    
                    // Stop playback after 5 seconds
                    setTimeout(() => {
                        exec('termux-media-player stop', () => {
                            message.channel.send({
                                embeds: [createEmbed({
                                    title: 'Playback Complete',
                                    description: 'Android audio test finished.',
                                    type: 'info'
                                })]
                            });
                        });
                    }, 5000);
                });
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