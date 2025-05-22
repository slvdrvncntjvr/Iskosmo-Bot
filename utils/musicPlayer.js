const { joinVoiceChannel, createAudioPlayer, createAudioResource, AudioPlayerStatus, VoiceConnectionStatus, entersState, StreamType } = require('@discordjs/voice');
const logger = require('./logger');
const YouTube = require('youtube-sr').default;
const playdl = require('play-dl');
const { createEmbed } = require('./embedBuilder'); // For sending messages

const players = new Map(); // Stores guildId -> playerInstance

// Ensures a player instance exists for a guild
function _ensurePlayer(guildId, textChannel = null) {
    if (!players.has(guildId)) {
        const newPlayer = {
            connection: null,
            audioPlayer: createAudioPlayer(),
            queue: [],
            isPlaying: false,
            currentSong: null,
            textChannel: textChannel, // Store the text channel for updates
            guildId: guildId,
            leaveTimeout: null, // For auto-leaving when idle
            currentVolume: 1.0, // Default volume 100% (decimal 1.0)

            _setupPlayerEvents: function() {
                this.audioPlayer.on('error', error => {
                    logger.error(`[MusicPlayer ${this.guildId}] Error in audio player: ${error.message}`, error);
                    this.isPlaying = false;
                    this.currentSong = null;
                    if (this.textChannel) {
                        const errorEmbed = createEmbed('Error', `An audio player error occurred: ${error.message}`);
                        this.textChannel.send({ embeds: [errorEmbed] }).catch(e => logger.error(`[MusicPlayer ${this.guildId}] Failed to send error message: ${e.message}`));
                    }
                    // Attempt to play next or clear if critical error
                    this._playNext();
                });

                this.audioPlayer.on(AudioPlayerStatus.Idle, () => {
                    logger.info(`[MusicPlayer ${this.guildId}] Player is idle.`);
                    const oldSong = this.currentSong;
                    this.isPlaying = false;
                    this.currentSong = null;
                    if (this.leaveTimeout) { // Clear any existing leave timeout
                        clearTimeout(this.leaveTimeout);
                        this.leaveTimeout = null;
                    }
                    this._playNext(oldSong);
                });

                this.audioPlayer.on(AudioPlayerStatus.Playing, () => {
                    logger.info(`[MusicPlayer ${this.guildId}] Player is now playing: ${this.currentSong?.title}`);
                    this.isPlaying = true;
                    if (this.leaveTimeout) {
                        clearTimeout(this.leaveTimeout);
                        this.leaveTimeout = null;
                    }
                    if (this.textChannel && this.currentSong) {
                        const nowPlayingEmbed = createEmbed('Now Playing', `🎵 Playing: **${this.currentSong.title}**\nDuration: ${this.currentSong.durationFormatted}\nRequested by: ${this.currentSong.requestedBy}`);
                        this.textChannel.send({ embeds: [nowPlayingEmbed] }).catch(e => logger.error(`[MusicPlayer ${this.guildId}] Failed to send 'Now Playing' message: ${e.message}`));
                    }
                });
            },

            _playNext: async function(lastSong = null) {
                if (this.queue.length > 0) {
                    const songToPlay = this.queue.shift();
                    await play(this.guildId, songToPlay); // Call the outer play function
                } else {
                    logger.info(`[MusicPlayer ${this.guildId}] Queue is empty.`);
                    if (this.textChannel) {
                        const queueEmptyEmbed = createEmbed('Queue Empty', 'The music queue is now empty.');
                        if (lastSong) { // Only send if a song just finished
                             this.textChannel.send({ embeds: [queueEmptyEmbed] }).catch(e => logger.error(`[MusicPlayer ${this.guildId}] Failed to send 'Queue Empty' message: ${e.message}`));
                        }
                    }
                    // Set a timeout to leave the voice channel if idle
                    this.leaveTimeout = setTimeout(() => {
                        if (!this.isPlaying && this.queue.length === 0 && this.connection) {
                            logger.info(`[MusicPlayer ${this.guildId}] Leaving voice channel due to inactivity.`);
                            if (this.textChannel) {
                                const leavingEmbed = createEmbed('Leaving Channel', 'Leaving voice channel due to inactivity.');
                                this.textChannel.send({ embeds: [leavingEmbed] }).catch(e => logger.error(`[MusicPlayer ${this.guildId}] Failed to send 'Leaving Channel' message: ${e.message}`));
                            }
                            leave(this.guildId);
                        }
                    }, 300000); // 5 minutes (300,000 ms)
                }
            }
        };
        newPlayer._setupPlayerEvents();
        players.set(guildId, newPlayer);
        logger.info(`[MusicPlayer ${guildId}] Created new player instance.`);
    }
    const playerInstance = players.get(guildId);
    // Update textChannel if a new one is provided (e.g., command used in different channel)
    if (textChannel && playerInstance.textChannel?.id !== textChannel.id) {
        logger.info(`[MusicPlayer ${guildId}] Updating text channel to ${textChannel.name}`);
        playerInstance.textChannel = textChannel;
    }
    return playerInstance;
}

function getGuildPlayer(guildId) {
    return players.get(guildId); // Might be undefined if not ensured first
}

async function join(guildId, voiceChannel, textChannel = null) {
    const playerInstance = _ensurePlayer(guildId, textChannel); // Ensure player exists and pass textChannel
    
    if (playerInstance.connection && playerInstance.connection.joinConfig.channelId === voiceChannel.id && playerInstance.connection.state.status === VoiceConnectionStatus.Ready) {
        logger.info(`[MusicPlayer ${guildId}] Already connected to voice channel ${voiceChannel.name}.`);
        return playerInstance;
    }
     if (playerInstance.connection) { // If connection exists but not ready or different channel
        logger.info(`[MusicPlayer ${guildId}] Destroying existing connection to rejoin.`);
        playerInstance.connection.destroy();
        playerInstance.connection = null;
    }

    try {
        const connection = joinVoiceChannel({
            channelId: voiceChannel.id,
            guildId: voiceChannel.guild.id,
            adapterCreator: voiceChannel.guild.voiceAdapterCreator,
            selfDeaf: true, // Bot deafens itself
        });
        playerInstance.connection = connection;
        
        connection.on(VoiceConnectionStatus.Disconnected, async (oldState, newState) => {
            logger.warn(`[MusicPlayer ${guildId}] Voice connection disconnected.`);
            try {
                await Promise.race([
                    entersState(connection, VoiceConnectionStatus.Signalling, 5_000),
                    entersState(connection, VoiceConnectionStatus.Connecting, 5_000),
                ]);
                // Connection recovered
                logger.info(`[MusicPlayer ${guildId}] Voice connection recovered.`);
            } catch (error) {
                logger.error(`[MusicPlayer ${guildId}] Voice connection could not recover. Destroying connection if not already destroyed.`);
                if (connection.state.status !== VoiceConnectionStatus.Destroyed) {
                    connection.destroy();
                }
                // playerInstance.connection = null; // Handled by Destroyed event
            }
        });

        connection.on(VoiceConnectionStatus.Destroyed, () => {
            logger.info(`[MusicPlayer ${guildId}] Voice connection destroyed.`);
            playerInstance.connection = null;
            playerInstance.isPlaying = false;
            playerInstance.currentSong = null;
            // playerInstance.queue = []; // Don't clear queue on temporary disconnects, only on explicit stop/leave
            if (playerInstance.audioPlayer) { // Stop player to prevent errors
                playerInstance.audioPlayer.stop(true);
            }
        });
        
        await entersState(connection, VoiceConnectionStatus.Ready, 20_000); // Wait for ready state (20s timeout)
        playerInstance.connection.subscribe(playerInstance.audioPlayer);
        logger.info(`[MusicPlayer ${guildId}] Joined voice channel ${voiceChannel.name} and subscribed audio player.`);
        return playerInstance;
    } catch (error) {
        logger.error(`[MusicPlayer ${guildId}] Could not join voice channel ${voiceChannel.name}: ${error.message}`, error);
        if (playerInstance.connection && playerInstance.connection.state.status !== VoiceConnectionStatus.Destroyed) {
            playerInstance.connection.destroy();
        }
        playerInstance.connection = null;
        throw new Error(`Failed to join voice channel: ${error.message}`);
    }
}

function leave(guildId) {
    const playerInstance = players.get(guildId);
    if (playerInstance) {
        if (playerInstance.connection) {
            playerInstance.connection.destroy();
            logger.info(`[MusicPlayer ${guildId}] Left voice channel.`);
        }
        if (playerInstance.audioPlayer) {
             playerInstance.audioPlayer.stop(true); // Stop player
        }
        playerInstance.queue = []; // Clear queue on leave
        playerInstance.isPlaying = false;
        playerInstance.currentSong = null;
        if (playerInstance.leaveTimeout) {
            clearTimeout(playerInstance.leaveTimeout);
            playerInstance.leaveTimeout = null;
        }
        // players.delete(guildId); // Optionally remove player instance on leave
    } else {
        logger.info(`[MusicPlayer ${guildId}] No player instance to leave from.`);
    }
}

async function play(guildId, songToPlay = null) {
    const playerInstance = _ensurePlayer(guildId); // Ensure player exists
    if (!playerInstance.connection) {
        logger.warn(`[MusicPlayer ${guildId}] Cannot play, not connected to a voice channel.`);
        if (playerInstance.textChannel) {
            const notConnectedEmbed = createEmbed('Error', 'I am not connected to a voice channel.');
            playerInstance.textChannel.send({ embeds: [notConnectedEmbed] }).catch(e => logger.error(`[MusicPlayer ${guildId}] Failed to send 'not connected' message: ${e.message}`));
        }
        return;
    }

    let song = songToPlay;
    if (!song) { // If no specific song is passed, try to get one from queue
        if (playerInstance.queue.length === 0) {
            logger.info(`[MusicPlayer ${guildId}] Queue is empty, nothing to play.`);
            // _playNext (called from Idle) will handle auto-leave message
            return;
        }
        song = playerInstance.queue.shift();
    }
    
    if (!song || !song.url) {
        logger.warn(`[MusicPlayer ${guildId}] Cannot play, song or song URL is undefined.`);
        if (playerInstance.textChannel) {
            const invalidSongEmbed = createEmbed('Error', 'Invalid song data, cannot play.');
            playerInstance.textChannel.send({ embeds: [invalidSongEmbed] }).catch(e => logger.error(`[MusicPlayer ${guildId}] Failed to send 'invalid song' message: ${e.message}`));
        }
        playerInstance.isPlaying = false; // Ensure isPlaying is false if we can't proceed
        playerInstance.currentSong = null;
        playerInstance._playNext(); // Try to play the next song
        return;
    }

    logger.info(`[MusicPlayer ${guildId}] Attempting to play: ${song.title} (${song.url})`);
    playerInstance.currentSong = song; // Set current song before playing

    try {
        // Validate stream URL (basic check for YouTube)
        if (!playdl.yt_validate(song.url)) {
            throw new Error('Invalid YouTube URL for streaming.');
        }
        const stream = await playdl.stream(song.url, {
            quality: 2, // Opus, high quality
            discordPlayerCompatibility: true
        });
        const resource = createAudioResource(stream.stream, {
            inputType: stream.type,
            metadata: song, // Attach song metadata
            inlineVolume: true // Enable inline volume control
        });

        // Set initial volume for this resource
        if (resource.volume) {
            resource.volume.setVolume(playerInstance.currentVolume);
        } else {
            logger.warn(`[MusicPlayer ${guildId}] Audio resource for ${song.title} does not have a volume property. Volume control might not work as expected.`);
        }
        
        playerInstance.audioPlayer.play(resource);
        // isPlaying and "Now playing" message are handled by AudioPlayerStatus.Playing event
    } catch (error) {
        logger.error(`[MusicPlayer ${guildId}] Error streaming song ${song.title}: ${error.message}`, error);
        if (playerInstance.textChannel) {
            const streamErrorEmbed = createEmbed('Error', `Could not play **${song.title}**: ${error.message}`);
            playerInstance.textChannel.send({ embeds: [streamErrorEmbed] }).catch(e => logger.error(`[MusicPlayer ${guildId}] Failed to send stream error message: ${e.message}`));
        }
        playerInstance.isPlaying = false;
        playerInstance.currentSong = null;
        playerInstance._playNext(); // Try to play the next song in queue
    }
}

function enqueue(guildId, songData, requestedByTag) {
    const playerInstance = _ensurePlayer(guildId);
    if (!songData || !songData.url || !songData.title) {
        logger.warn(`[MusicPlayer ${guildId}] Attempted to enqueue an undefined or incomplete song.`);
        return null;
    }
    const song = {
        title: songData.title,
        url: songData.url,
        duration: songData.duration || 0, // Store duration in seconds
        durationFormatted: songData.durationFormatted || 'N/A',
        thumbnail: songData.thumbnail?.url,
        requestedBy: requestedByTag,
    };
    playerInstance.queue.push(song);
    logger.info(`[MusicPlayer ${guildId}] Enqueued song: ${song.title}. Queue size: ${playerInstance.queue.length}`);
    return song;
}

async function handlePlayCommand(query, voiceChannel, textChannel, requestedByTag) {
    const guildId = voiceChannel.guild.id;
    const playerInstance = _ensurePlayer(guildId, textChannel); // Pass textChannel here

    let songInfo;
    try {
        // Check if query is a URL
        const isUrl = query.startsWith('http://') || query.startsWith('https://');
        if (isUrl) {
            if (YouTube.validate(query, 'VIDEO_URL') || YouTube.validate(query, 'PLAYLIST_URL')) { // Basic validation
                 if (playdl.yt_validate(query) === 'video') {
                    const videoInfo = await playdl.video_info(query);
                    if (!videoInfo) throw new Error('Could not fetch video information from URL.');
                    songInfo = {
                        title: videoInfo.video_details.title,
                        url: videoInfo.video_details.url,
                        duration: videoInfo.video_details.durationInSec,
                        durationFormatted: videoInfo.video_details.durationRaw,
                        thumbnail: videoInfo.video_details.thumbnails?.[0], // First thumbnail
                    };
                } else if (playdl.yt_validate(query) === 'playlist') {
                    // Playlist handling can be complex (enqueue all, confirmation, etc.)
                    // For now, let's just play/enqueue the first video of a playlist or inform user.
                    // Or, better, inform user that playlist links are not directly streamable this way, search for individual songs.
                    // For simplicity in this step, we'll just take the first song of a playlist if detected.
                    // await textChannel.send({ embeds: [createEmbed('Info', 'Playlist URLs are not fully supported yet. Trying to add the first song.')]});
                    const playlistInfo = await playdl.playlist_info(query, { incomplete: true }); // Get basic info
                    if (!playlistInfo || playlistInfo.videos.length === 0) {
                        throw new Error('Could not fetch playlist information or playlist is empty.');
                    }
                    const firstVideo = await playlistInfo.videos[0].fetch(); // Fetch full details for the first video
                     songInfo = {
                        title: firstVideo.title,
                        url: firstVideo.url,
                        duration: firstVideo.durationInSec,
                        durationFormatted: firstVideo.durationRaw,
                        thumbnail: firstVideo.thumbnails?.[0],
                    };
                     logger.info(`[MusicPlayer ${guildId}] Playlist link detected. Using first song: ${songInfo.title}`);
                     // Optionally, inform the user that only the first song is added or queue all.
                     // For now, just adding the first song.
                } else {
                    throw new Error('Invalid or unsupported YouTube URL.');
                }
            } else {
                 // Attempt to handle non-YouTube URLs if play-dl supports them, or throw error
                const streamInfo = await playdl.video_basic_info(query).catch(() => null);
                if (streamInfo) {
                     songInfo = {
                        title: streamInfo.video_details.title,
                        url: streamInfo.video_details.url,
                        duration: streamInfo.video_details.durationInSec,
                        durationFormatted: streamInfo.video_details.durationRaw,
                        thumbnail: streamInfo.video_details.thumbnails?.[0],
                    };
                } else {
                    throw new Error('Invalid URL or URL type not supported for direct play.');
                }
            }
        } else {
            // Search YouTube using youtube-sr
            const searchResults = await YouTube.search(query, { limit: 1, type: 'video' });
            if (searchResults.length === 0) {
                const noResultsEmbed = createEmbed('No Results', `No results found for "${query}".`);
                await textChannel.send({ embeds: [noResultsEmbed] });
                return;
            }
            const video = searchResults[0];
            songInfo = {
                title: video.title,
                url: video.url,
                duration: video.duration / 1000, // ms to s
                durationFormatted: video.durationFormatted,
                thumbnail: video.thumbnail,
            };
        }

        if (!songInfo || !songInfo.title || !songInfo.url) {
            throw new Error('Failed to retrieve valid song information.');
        }
        
        const enqueuedSong = enqueue(guildId, songInfo, requestedByTag);

        if (!playerInstance.connection) {
            await join(guildId, voiceChannel, textChannel); // Pass textChannel to join
        }
        
        // If not playing and player is ready, start playback.
        // The play function itself will take from queue if no specific song is passed.
        // AudioPlayerStatus.Idle event will also trigger _playNext.
        if (!playerInstance.isPlaying && playerInstance.audioPlayer.state.status === AudioPlayerStatus.Idle) {
            await play(guildId); // Will pick from queue
        } else if (playerInstance.isPlaying && enqueuedSong) { // ensure enqueuedSong is not null
            const addedToQueueEmbed = createEmbed('Added to Queue', `✅ Added **${enqueuedSong.title}** to the queue.\nRequested by: ${enqueuedSong.requestedBy}`);
            await textChannel.send({ embeds: [addedToQueueEmbed] });
        }
        // "Now playing" message is handled by the 'Playing' event of the audioPlayer

    } catch (error) {
        logger.error(`[MusicPlayer ${guildId}] Error in handlePlayCommand for query "${query}": ${error.message}`, error);
        const errorEmbed = createEmbed('Error', `Could not process your request: ${error.message}`);
        await textChannel.send({ embeds: [errorEmbed] });
        // If critical error, could also stop player or leave channel
    }
}


function skip(guildId) {
    const playerInstance = players.get(guildId);
    if (playerInstance && playerInstance.audioPlayer && (playerInstance.isPlaying || playerInstance.audioPlayer.state.status === AudioPlayerStatus.Paused) && playerInstance.currentSong) {
        const skippedSongTitle = playerInstance.currentSong.title;
        logger.info(`[MusicPlayer ${guildId}] Skipping current song: ${skippedSongTitle}`);
        playerInstance.audioPlayer.stop(); // Triggers Idle state, which calls _playNext
        // The Idle event (_playNext) will handle messages for "Now playing next" or "Queue empty".
        // The command file is now responsible for sending the "Skipped X" message.
        return { skipped: true, songTitle: skippedSongTitle };
    } else {
        logger.info(`[MusicPlayer ${guildId}] Nothing to skip or player not active/no current song.`);
        // Optionally, send a message if the command invoking this expects a message always
        // For now, returning a status is enough, command file will handle user feedback.
        return { skipped: false, reason: 'There is no song currently playing to skip.' };
    }
}

function stop(guildId) {
    const playerInstance = players.get(guildId);
    if (playerInstance) {
        logger.info(`[MusicPlayer ${guildId}] Stopping playback, clearing queue, and leaving voice channel.`);
        playerInstance.queue = [];
        if (playerInstance.audioPlayer) {
            // Stop the player without triggering the Idle event to play the next song
            playerInstance.audioPlayer.stop(true); 
        }
        playerInstance.isPlaying = false;
        playerInstance.currentSong = null;

        if (playerInstance.connection) {
            playerInstance.connection.destroy();
            // connection's 'Destroyed' event will set playerInstance.connection = null
        }
        
        if (playerInstance.leaveTimeout) {
            clearTimeout(playerInstance.leaveTimeout);
            playerInstance.leaveTimeout = null;
        }
        
        // The command file is now responsible for sending the confirmation message.
        // Remove the player instance from the map
        players.delete(guildId);
        logger.info(`[MusicPlayer ${guildId}] Player instance removed.`);
        return { stopped: true };
    } else {
        logger.info(`[MusicPlayer ${guildId}] No player instance to stop.`);
        return { stopped: false, reason: 'Bot is not connected or no player instance found.' };
    }
}

function getQueue(guildId) {
    const playerInstance = players.get(guildId);
    if (playerInstance) {
        // The queue in playerInstance is already the list of upcoming songs
        // currentSong holds the song that is currently playing
        return {
            nowPlaying: playerInstance.currentSong || null,
            upcoming: playerInstance.queue || [] 
        };
    }
    return { nowPlaying: null, upcoming: [] }; // Return empty state if no player
}

function getNowPlaying(guildId) {
    const playerInstance = players.get(guildId);
    if (playerInstance && 
        playerInstance.currentSong && 
        playerInstance.audioPlayer && 
        playerInstance.audioPlayer.state.status === AudioPlayerStatus.Playing && // Ensure it's actually playing
        playerInstance.audioPlayer.state.resource) {
        
        return {
            ...playerInstance.currentSong, // title, url, duration (total in s), requestedBy, thumbnail
            playbackDuration: playerInstance.audioPlayer.state.resource.playbackDuration || 0 // current playback in ms
        };
    }
    return null; // Nothing playing or player/resource not available
}

// Leave function, which will essentially be an alias for stop for full cleanup
function leave(guildId) {
    logger.info(`[MusicPlayer ${guildId}] Leave command called. Executing stop procedure.`);
    const result = stop(guildId); // stop() already handles cleanup and player map removal
    if (result.stopped) {
        return { left: true };
    } else {
        return { left: false, reason: result.reason || 'Failed to stop and leave the channel.' };
    }
}

function setVolume(guildId, volumeLevel) {
    const playerInstance = players.get(guildId);
    if (!playerInstance) {
        return { success: false, reason: 'No active player instance for this server.' };
    }

    if (!playerInstance.audioPlayer || !playerInstance.audioPlayer.state.resource || playerInstance.audioPlayer.state.status !== AudioPlayerStatus.Playing) {
        return { success: false, reason: 'Nothing is currently playing or the player is not in a state where volume can be changed.' };
    }
    
    const resource = playerInstance.audioPlayer.state.resource;
    if (!resource.volume) {
        logger.warn(`[MusicPlayer ${guildId}] Current audio resource does not support inline volume adjustment. This may be because it's not an Opus stream or inlineVolume was not set to true.`);
        return { success: false, reason: 'The current audio stream does not support volume adjustment. This might be a temporary issue with the stream or an unsupported stream type for volume control.' };
    }

    // Validate volumeLevel (0-200 from command) and convert to decimal (0.0-2.0 for resource.volume.setVolume)
    // Ensure volumeLevel is treated as a number before division.
    const newVolumeDecimal = Math.max(0, Math.min(Number(volumeLevel) / 100, 2)); 

    try {
        resource.volume.setVolume(newVolumeDecimal);
        playerInstance.currentVolume = newVolumeDecimal; // Store the new volume for future songs
        logger.info(`[MusicPlayer ${guildId}] Volume set to ${Math.round(newVolumeDecimal * 100)}% (decimal: ${newVolumeDecimal})`);
        return { success: true, volume: Math.round(newVolumeDecimal * 100) }; // Return the percentage value
    } catch (error) {
        logger.error(`[MusicPlayer ${guildId}] Error setting volume: ${error.message}`, error);
        return { success: false, reason: `Failed to set volume: ${error.message}` };
    }
}

module.exports = {
    getGuildPlayer, // Use with caution, ensure player is created via _ensurePlayer or handlePlayCommand
    join,
    leave, // Now implemented
    play, // Typically called internally by handlePlayCommand or player events
    enqueue, // Typically called internally
    skip,
    stop,
    setVolume, // Added setVolume method
    getQueue,
    getNowPlaying, // Added getNowPlaying method
    handlePlayCommand, // Main entry point for play commands
    _ensurePlayer // Exporting for potential direct use or testing, though typically private
};
