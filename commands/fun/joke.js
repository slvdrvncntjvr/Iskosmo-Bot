const { SlashCommandBuilder } = require('discord.js');
const { createEmbed } = require('../../utils/embedBuilder');
const fetch = require('node-fetch');

module.exports = {
    name: 'joke',
    description: 'Get a random joke',
    category: 'fun',

    slashCommand: new SlashCommandBuilder()
        .setName('joke')
        .setDescription('Get a random joke'),
    
    async execute(message, args, client) {
        try {
            const response = await fetch('https://official-joke-api.appspot.com/random_joke');
            const joke = await response.json();
            
            const jokeEmbed = createEmbed({
                title: '😂 Random Joke',
                description: `**${joke.setup}**\n\n${joke.punchline}`,
                type: 'info'
            });
            
            message.reply({ embeds: [jokeEmbed] });
        } catch (error) {
            message.reply({ 
                embeds: [createEmbed({
                    title: 'Error',
                    description: 'Failed to fetch a joke. Please try again later.',
                    type: 'error'
                })]
            });
        }
    },
    
    async executeSlash(interaction, client) {
        await interaction.deferReply();
        
        try {
            const response = await fetch('https://official-joke-api.appspot.com/random_joke');
            const joke = await response.json();
            
            const jokeEmbed = createEmbed({
                title: '😂 Random Joke',
                description: `**${joke.setup}**\n\n${joke.punchline}`,
                type: 'info'
            });
            
            interaction.editReply({ embeds: [jokeEmbed] });
        } catch (error) {
            interaction.editReply({ 
                embeds: [createEmbed({
                    title: 'Error',
                    description: 'Failed to fetch a joke. Please try again later.',
                    type: 'error'
                })]
            });
        }
    }
};