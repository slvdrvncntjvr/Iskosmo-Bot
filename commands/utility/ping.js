const { SlashCommandBuilder } = require('discord.js');
const { createEmbed } = require('../../utils/embedBuilder');

module.exports = {
    name: 'ping',
    description: 'Check bot latency and API response time',
    category: 'utility',
    
    // Slash command definition
    slashCommand: new SlashCommandBuilder()
        .setName('ping')
        .setDescription('Check bot latency and API response time'),
    
    async execute(message, args, client) {
        const sent = await message.reply({ content: 'Pinging...' });
        
        const pingEmbed = createEmbed({
            title: '🏓 Pong!',
            description: `Latency: ${sent.createdTimestamp - message.createdTimestamp}ms\nAPI Latency: ${Math.round(client.ws.ping)}ms`,
            type: 'info'
        });
        
        sent.edit({ content: null, embeds: [pingEmbed] });
    },
    
    async executeSlash(interaction, client) {
        await interaction.deferReply();
        
        const pingEmbed = createEmbed({
            title: '🏓 Pong!',
            description: `Latency: ${Date.now() - interaction.createdTimestamp}ms\nAPI Latency: ${Math.round(client.ws.ping)}ms`,
            type: 'info'
        });
        
        await interaction.editReply({ embeds: [pingEmbed] });
    }
};