const { SlashCommandBuilder } = require('discord.js');
const { createEmbed } = require('../../utils/embedBuilder');
const { joinVoiceChannel, createAudioPlayer, createAudioResource, AudioPlayerStatus, NoSubscriberBehavior } = require('@discordjs/voice');
const play = require('play-dl');
const logger = require('../../utils/logger');

if (!global.musicQueues) {
    global.musicQueues = new Map();
}

module.exports = {
    name: 'play',
    description: 'Play a song from YouTube',
    usage: '<YouTube URL or search term>',
    category: 'music',
    guildOnly: true,

    slashCommand: new SlashCommandBuilder()
        .setName('play')
        .setDescription('Play a song from YouTube')
        .addStringOption(option => 
            option.setName('query')
                .setDescription('YouTube URL or search term')
                .setRequired(true)),

    async execute(message, args, client) {
        if (!message.member.voice.channel) {
            return message.reply({
                embeds: [createEmbed({
                    title: 'Error',
                    description: 'You need to be in a voice channel to play music!',
                    type: 'error'
                })]
            });
        }

        if (!args.length) {
            return message.reply({
                embeds: [createEmbed({
                    title: 'Error',
                    description: 'Please provide a YouTube URL or search term!',
                    type: 'error'
                })]
            });
        }

        let serverQueue = global.musicQueues.get(message.guild.id);
        if (!serverQueue) {
            serverQueue = {
                voiceChannel: message.member.voice.channel,
                textChannel: message.channel,
                connection: null,
                player: createAudioPlayer({
                    behaviors: {
                        noSubscriber: NoSubscriberBehavior.Pause,
                    },
                }),
                songs: [],
                volume: 50,
                playing: false
            };
            global.musicQueues.set(message.guild.id, serverQueue);
        }

        try {
            const searchingMsg = await message.reply({
                embeds: [createEmbed({
                    title: '🔍 Searching...',
                    description: `Looking for: ${args.join(' ')}`,
                    type: 'info'
                })]
            });

            const query = args.join(' ');
            let songInfo;

            if (query.includes('youtube.com/watch') || query.includes('youtu.be/')) {
                const validateURL = await play.validate(query);
                if (validateURL) {
                    const videoInfo = await play.video_info(query);
                    songInfo = {
                        title: videoInfo.video_details.title,
                        url: videoInfo.video_details.url,
                        duration: videoInfo.video_details.durationRaw
                    };
                } else {
                    return searchingMsg.edit({
                        embeds: [createEmbed({
                            title: 'Error',
                            description: 'Invalid YouTube URL!',
                            type: 'error'
                        })]
                    });
                }
            } else {
                const searchResults = await play.search(query, { limit: 1 });
                if (searchResults && searchResults.length > 0) {
                    songInfo = {
                        title: searchResults[0].title,
                        url: searchResults[0].url,
                        duration: searchResults[0].durationRaw
                    };
                } else {
                    return searchingMsg.edit({
                        embeds: [createEmbed({
                            title: 'Error',
                            description: 'No results found!',
                            type: 'error'
                        })]
                    });
                }
            }

            const song = {
                title: songInfo.title,
                url: songInfo.url,
                duration: songInfo.duration || 'Unknown',
                requestedBy: message.author.tag
            };

            serverQueue.songs.push(song);

            searchingMsg.edit({
                embeds: [createEmbed({
                    title: '🎵 Added to Queue',
                    description: `**${song.title}** has been added to the queue!`,
                    type: 'success',
                    fields: [
                        { name: 'Duration', value: song.duration, inline: true },
                        { name: 'Requested By', value: song.requestedBy, inline: true }
                    ]
                })]
            });

            if (!serverQueue.playing) {
                try {
                    const connection = joinVoiceChannel({
                        channelId: serverQueue.voiceChannel.id,
                        guildId: message.guild.id,
                        adapterCreator: message.guild.voiceAdapterCreator,
                    });
                    serverQueue.connection = connection;
                    serverQueue.playing = true;

                    serverQueue.player.on(AudioPlayerStatus.Idle, () => {
                        serverQueue.songs.shift();
                        playSong(message.guild.id, client);
                    });

                    connection.subscribe(serverQueue.player);

                    await playSong(message.guild.id, client);
                } catch (err) {
                    logger.error('Error creating voice connection:', err);
                    global.musicQueues.delete(message.guild.id);
                    return message.channel.send({
                        embeds: [createEmbed({
                            title: 'Error',
                            description: `Could not join voice channel: ${err.message}`,
                            type: 'error'
                        })]
                    });
                }
            }
        } catch (error) {
            logger.error('Error in play command:', error);
            message.channel.send({
                embeds: [createEmbed({
                    title: 'Error',
                    description: `An error occurred: ${error.message}`,
                    type: 'error'
                })]
            });
        }
    },

    async executeSlash(interaction, client) {
        if (!interaction.member.voice.channel) {
            return interaction.reply({
                embeds: [createEmbed({
                    title: 'Error',
                    description: 'You need to be in a voice channel to play music!',
                    type: 'error'
                })],
                ephemeral: true
            });
        }

        await interaction.deferReply();
        const query = interaction.options.getString('query');

        let serverQueue = global.musicQueues.get(interaction.guild.id);
        if (!serverQueue) {
            serverQueue = {
                voiceChannel: interaction.member.voice.channel,
                textChannel: interaction.channel,
                connection: null,
                player: createAudioPlayer({
                    behaviors: {
                        noSubscriber: NoSubscriberBehavior.Pause,
                    },
                }),
                songs: [],
                volume: 50,
                playing: false
            };
            global.musicQueues.set(interaction.guild.id, serverQueue);
        }

        try {
            let songInfo;

            if (query.includes('youtube.com/watch') || query.includes('youtu.be/')) {
                const validateURL = await play.validate(query);
                if (validateURL) {
                    const videoInfo = await play.video_info(query);
                    songInfo = {
                        title: videoInfo.video_details.title,
                        url: videoInfo.video_details.url,
                        duration: videoInfo.video_details.durationRaw
                    };
                } else {
                    return interaction.editReply({
                        embeds: [createEmbed({
                            title: 'Error',
                            description: 'Invalid YouTube URL!',
                            type: 'error'
                        })]
                    });
                }
            } else {
                const searchResults = await play.search(query, { limit: 1 });
                if (searchResults && searchResults.length > 0) {
                    songInfo = {
                        title: searchResults[0].title,
                        url: searchResults[0].url,
                        duration: searchResults[0].durationRaw
                    };
                } else {
                    return interaction.editReply({
                        embeds: [createEmbed({
                            title: 'Error',
                            description: 'No results found!',
                            type: 'error'
                        })]
                    });
                }
            }

            const song = {
                title: songInfo.title,
                url: songInfo.url,
                duration: songInfo.duration || 'Unknown',
                requestedBy: interaction.user.tag
            };

            serverQueue.songs.push(song);

            interaction.editReply({
                embeds: [createEmbed({
                    title: '🎵 Added to Queue',
                    description: `**${song.title}** has been added to the queue!`,
                    type: 'success',
                    fields: [
                        { name: 'Duration', value: song.duration, inline: true },
                        { name: 'Requested By', value: song.requestedBy, inline: true }
                    ]
                })]
            });

            if (!serverQueue.playing) {
                try {
                    const connection = joinVoiceChannel({
                        channelId: serverQueue.voiceChannel.id,
                        guildId: interaction.guild.id,
                        adapterCreator: interaction.guild.voiceAdapterCreator,
                    });
                    serverQueue.connection = connection;
                    serverQueue.playing = true;

                    serverQueue.player.on(AudioPlayerStatus.Idle, () => {
                        serverQueue.songs.shift();
                        playSong(interaction.guild.id, client);
                    });

                    connection.subscribe(serverQueue.player);

                    await playSong(interaction.guild.id, client);
                } catch (err) {
                    logger.error('Error creating voice connection:', err);
                    global.musicQueues.delete(interaction.guild.id);
                    return interaction.channel.send({
                        embeds: [createEmbed({
                            title: 'Error',
                            description: `Could not join voice channel: ${err.message}`,
                            type: 'error'
                        })]
                    });
                }
            }
        } catch (error) {
            logger.error('Error in play slash command:', error);
            interaction.editReply({
                embeds: [createEmbed({
                    title: 'Error',
                    description: `An error occurred: ${error.message}`,
                    type: 'error'
                })]
            });
        }
    }
};

async function playSong(guildId, client) {
    const serverQueue = global.musicQueues.get(guildId);
    
    if (!serverQueue || serverQueue.songs.length === 0) {
        if (serverQueue?.connection) {
            serverQueue.connection.destroy();
        }
        global.musicQueues.delete(guildId);
        return;
    }
    
    try {
        const song = serverQueue.songs[0];
        
        const stream = await play.stream(song.url);
        
        const resource = createAudioResource(stream.stream, { 
            inputType: stream.type,
            inlineVolume: true 
        });
        
        resource.volume.setVolume(serverQueue.volume / 100);
        
        serverQueue.player.play(resource);
        
        serverQueue.textChannel.send({
            embeds: [createEmbed({
                title: '🎵 Now Playing',
                description: `**${song.title}**`,
                type: 'info',
                fields: [
                    { name: 'Duration', value: song.duration, inline: true },
                    { name: 'Requested By', value: song.requestedBy, inline: true }
                ]
            })]
        });
    } catch (error) {
        logger.error('Error playing song:', error);
        serverQueue.textChannel.send({
            embeds: [createEmbed({
                title: 'Error',
                description: `Could not play song: ${error.message}`,
                type: 'error'
            })]
        });
        
        serverQueue.songs.shift();
        playSong(guildId, client);
    }
}
