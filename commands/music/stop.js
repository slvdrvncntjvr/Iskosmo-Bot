const { SlashCommandBuilder } = require('discord.js');
const { createEmbed } = require('../../utils/embedBuilder');
const logger = require('../../utils/logger');

module.exports = {
    name: 'stop',
    description: 'Stop playing music and leave the voice channel',
    category: 'music',
    guildOnly: true,

    slashCommand: new SlashCommandBuilder()
        .setName('stop')
        .setDescription('Stop playing music and leave the voice channel'),

    async execute(message, args, client) {
        if (!message.member.voice.channel) {
            return message.reply({
                embeds: [createEmbed({
                    title: 'Error',
                    description: 'You need to be in a voice channel to stop the music!',
                    type: 'error'
                })]
            });
        }

        const serverQueue = global.musicQueues?.get(message.guild.id);
        
        if (!serverQueue) {
            return message.reply({
                embeds: [createEmbed({
                    title: 'Error',
                    description: 'There is no music playing!',
                    type: 'error'
                })]
            });
        }

        serverQueue.songs = [];
        if (serverQueue.player) {
            serverQueue.player.stop();
        }
        if (serverQueue.connection) {
            serverQueue.connection.destroy();
        }
        global.musicQueues.delete(message.guild.id);

        message.reply({
            embeds: [createEmbed({
                title: '⏹️ Stopped',
                description: 'Music playback has been stopped and I have left the voice channel.',
                type: 'success'
            })]
        });
    },

    async executeSlash(interaction, client) {
        if (!interaction.member.voice.channel) {
            return interaction.reply({
                embeds: [createEmbed({
                    title: 'Error',
                    description: 'You need to be in a voice channel to stop the music!',
                    type: 'error'
                })],
                ephemeral: true
            });
        }

        const serverQueue = global.musicQueues?.get(interaction.guild.id);
        
        if (!serverQueue) {
            return interaction.reply({
                embeds: [createEmbed({
                    title: 'Error',
                    description: 'There is no music playing!',
                    type: 'error'
                })],
                ephemeral: true
            });
        }

        serverQueue.songs = [];
        if (serverQueue.player) {
            serverQueue.player.stop();
        }
        if (serverQueue.connection) {
            serverQueue.connection.destroy();
        }
        global.musicQueues.delete(interaction.guild.id);

        interaction.reply({
            embeds: [createEmbed({
                title: '⏹️ Stopped',
                description: 'Music playback has been stopped and I have left the voice channel.',
                type: 'success'
            })]
        });
    }
};