const { SlashCommandBuilder } = require('discord.js');
const config = require('../../config');
const { createEmbed } = require('../../utils/embedBuilder');

module.exports = {
    name: 'help',
    description: 'Display available commands or info about a specific command',
    usage: '[command name]',
    category: 'utility',

    slashCommand: new SlashCommandBuilder()
        .setName('help')
        .setDescription('Display available commands or info about a specific command')
        .addStringOption(option => 
            option.setName('command')
                .setDescription('The specific command to get info about')
                .setRequired(false)),
    
    async execute(message, args, client) {
        const { commands } = client;
 
        if (!args.length) {
            const categories = {};
            commands.forEach(command => {
                const category = command.category || 'Uncategorized';
                
                if (!categories[category]) {
                    categories[category] = [];
                }
                
                categories[category].push(command);
            });
            
            const helpEmbed = createEmbed({
                title: 'Command Help',
                description: `Use \`${config.prefix}help [command name]\` to get info on a specific command.`,
                type: 'info'
            });

            for (const [category, cmds] of Object.entries(categories)) {
                helpEmbed.addFields({
                    name: `📁 ${category.charAt(0).toUpperCase() + category.slice(1)}`,
                    value: cmds.map(cmd => `\`${cmd.name}\`: ${cmd.description}`).join('\n')
                });
            }
            
            return message.reply({ embeds: [helpEmbed] });
        }
        
        const commandName = args[0].toLowerCase();
        const command = commands.get(commandName);
        
        if (!command) {
            return message.reply({ 
                embeds: [createEmbed({
                    title: 'Command Not Found',
                    description: `Could not find command \`${commandName}\`.`,
                    type: 'error'
                })]
            });
        }
        
        const commandEmbed = createEmbed({
            title: `Command: ${command.name}`,
            description: command.description,
            type: 'info'
        });
        
        if (command.aliases) {
            commandEmbed.addFields({ name: 'Aliases', value: command.aliases.join(', ') });
        }
        
        if (command.usage) {
            commandEmbed.addFields({ name: 'Usage', value: `${config.prefix}${command.name} ${command.usage}` });
        }
        
        message.reply({ embeds: [commandEmbed] });
    },
    
    async executeSlash(interaction, client) {
        const commandName = interaction.options.getString('command');
        const { commands } = client;

        if (!commandName) {
            const categories = {};
            
            commands.forEach(command => {
                const category = command.category || 'Uncategorized';
                
                if (!categories[category]) {
                    categories[category] = [];
                }
                
                categories[category].push(command);
            });
            
            const helpEmbed = createEmbed({
                title: 'Command Help',
                description: `Use \`/help command:[command name]\` to get info on a specific command.`,
                type: 'info'
            });

            for (const [category, cmds] of Object.entries(categories)) {
                helpEmbed.addFields({
                    name: `📁 ${category.charAt(0).toUpperCase() + category.slice(1)}`,
                    value: cmds.map(cmd => `\`${cmd.name}\`: ${cmd.description}`).join('\n')
                });
            }
            
            return interaction.reply({ embeds: [helpEmbed] });
        }
        
        const command = commands.get(commandName.toLowerCase());
        
        if (!command) {
            return interaction.reply({ 
                embeds: [createEmbed({
                    title: 'Command Not Found',
                    description: `Could not find command \`${commandName}\`.`,
                    type: 'error'
                })],
                ephemeral: true
            });
        }
        
        const commandEmbed = createEmbed({
            title: `Command: ${command.name}`,
            description: command.description,
            type: 'info'
        });
        
        if (command.aliases) {
            commandEmbed.addFields({ name: 'Aliases', value: command.aliases.join(', ') });
        }
        
        if (command.usage) {
            commandEmbed.addFields({ name: 'Usage', value: `${config.prefix}${command.name} ${command.usage}` });
        }
        
        interaction.reply({ embeds: [commandEmbed] });
    }
};