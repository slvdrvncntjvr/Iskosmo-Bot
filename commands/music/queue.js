const { SlashCommandBuilder } = require('discord.js');
const { createEmbed } = require('../../utils/embedBuilder');

module.exports = {
    name: 'queue',
    description: 'Show the current music queue',
    category: 'music',
    guildOnly: true,

    slashCommand: new SlashCommandBuilder()
        .setName('queue')
        .setDescription('Show the current music queue'),

    async execute(message, args, client) {
        const serverQueue = global.musicQueues?.get(message.guild.id);
        
        if (!serverQueue || !serverQueue.songs.length) {
            return message.reply({
                embeds: [createEmbed({
                    title: 'Queue',
                    description: 'The music queue is empty!',
                    type: 'info'
                })]
            });
        }

        const queueList = serverQueue.songs.map((song, index) => 
            `${index + 1}. **${song.title}** (${song.duration}) - Requested by: ${song.requestedBy}`
        ).join('\n');

        message.reply({
            embeds: [createEmbed({
                title: '🎵 Music Queue',
                description: queueList.length > 2000 
                    ? queueList.substring(0, 1997) + '...' 
                    : queueList,
                type: 'info',
                fields: [
                    { name: 'Now Playing', value: serverQueue.songs[0].title, inline: true },
                    { name: 'Total Songs', value: serverQueue.songs.length.toString(), inline: true }
                ]
            })]
        });
    },

    async executeSlash(interaction, client) {
        const serverQueue = global.musicQueues?.get(interaction.guild.id);
        
        if (!serverQueue || !serverQueue.songs.length) {
            return interaction.reply({
                embeds: [createEmbed({
                    title: 'Queue',
                    description: 'The music queue is empty!',
                    type: 'info'
                })]
            });
        }

        const queueList = serverQueue.songs.map((song, index) => 
            `${index + 1}. **${song.title}** (${song.duration}) - Requested by: ${song.requestedBy}`
        ).join('\n');

        interaction.reply({
            embeds: [createEmbed({
                title: '🎵 Music Queue',
                description: queueList.length > 2000 
                    ? queueList.substring(0, 1997) + '...' 
                    : queueList,
                type: 'info',
                fields: [
                    { name: 'Now Playing', value: serverQueue.songs[0].title, inline: true },
                    { name: 'Total Songs', value: serverQueue.songs.length.toString(), inline: true }
                ]
            })]
        });
    }
};