const { SlashCommandBuilder } = require('discord.js');
const { createEmbed } = require('../../utils/embedBuilder');
const logger = require('../../utils/logger');

module.exports = {
    name: 'skip',
    description: 'Skip to the next song in the queue',
    category: 'music',
    guildOnly: true,

    slashCommand: new SlashCommandBuilder()
        .setName('skip')
        .setDescription('Skip to the next song in the queue'),

    async execute(message, args, client) {
        if (!message.member.voice.channel) {
            return message.reply({
                embeds: [createEmbed({
                    title: 'Error',
                    description: 'You need to be in a voice channel to skip the music!',
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

        if (serverQueue.player) {
            serverQueue.player.stop();
        }

        message.reply({
            embeds: [createEmbed({
                title: '⏭️ Skipped',
                description: 'Skipped to the next song!',
                type: 'success'
            })]
        });
    },

    async executeSlash(interaction, client) {
        if (!interaction.member.voice.channel) {
            return interaction.reply({
                embeds: [createEmbed({
                    title: 'Error',
                    description: 'You need to be in a voice channel to skip the music!',
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

        if (serverQueue.player) {
            serverQueue.player.stop();
        }

        interaction.reply({
            embeds: [createEmbed({
                title: '⏭️ Skipped',
                description: 'Skipped to the next song!',
                type: 'success'
            })]
        });
    }
};