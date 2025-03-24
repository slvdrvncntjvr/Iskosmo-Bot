const config = require('../config');
const logger = require('../utils/logger');
const { createEmbed } = require('../utils/embedBuilder');

module.exports = {
    once: false,
    async execute(message, client) {
        // Ignore bot messages and messages without the prefix
        if (message.author.bot || !message.content.startsWith(config.prefix)) return;
        
        // Parse command and arguments
        const args = message.content.slice(config.prefix.length).trim().split(/ +/);
        const commandName = args.shift().toLowerCase();
        
        // Check if command exists
        if (!client.commands.has(commandName)) return;
        
        const command = client.commands.get(commandName);
        
        // Check if command can be executed in DMs
        if (command.guildOnly && message.channel.type === 'DM') {
            return message.reply({ 
                embeds: [createEmbed({
                    title: 'Command Error',
                    description: 'This command cannot be executed in DMs.',
                    type: 'error'
                })]
            });
        }
        
        // Check if user has required permissions
        if (command.permissions && message.guild) {
            const authorPerms = message.channel.permissionsFor(message.author);
            if (!authorPerms || !command.permissions.every(perm => authorPerms.has(perm))) {
                return message.reply({ 
                    embeds: [createEmbed({
                        title: 'Permission Error',
                        description: 'You do not have permission to use this command.',
                        type: 'error'
                    })]
                });
            }
        }
        
        // Check if command requires arguments
        if (command.args && !args.length) {
            let reply = 'You didn\'t provide any arguments.';
            
            if (command.usage) {
                reply += `\nUsage: \`${config.prefix}${command.name} ${command.usage}\``;
            }
            
            return message.reply({ 
                embeds: [createEmbed({
                    title: 'Command Error',
                    description: reply,
                    type: 'error'
                })]
            });
        }
        
        // Execute command
        try {
            await command.execute(message, args, client);
            logger.info(`${message.author.tag} used command: ${commandName}`);
        } catch (error) {
            logger.error(`Error executing ${commandName} command:`, error);
            message.reply({ 
                embeds: [createEmbed({
                    title: 'Command Error',
                    description: 'There was an error executing that command.',
                    type: 'error'
                })]
            });
        }
    },
};