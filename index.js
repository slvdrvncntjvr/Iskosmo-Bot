require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { Client, GatewayIntentBits, Collection } = require('discord.js');
const config = require('./config');
const logger = require('./utils/logger');

// Initialize client with required intents
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildMembers,
    ]
});

// Initialize collections
client.commands = new Collection();
client.slashCommands = new Collection();

// Load commands
const loadCommands = (dir) => {
    const commandFolders = fs.readdirSync(path.join(__dirname, dir));
    
    for (const folder of commandFolders) {
        const commandFiles = fs.readdirSync(path.join(__dirname, dir, folder))
            .filter(file => file.endsWith('.js'));
        
        for (const file of commandFiles) {
            const command = require(path.join(__dirname, dir, folder, file));
            logger.info(`Loading command: ${command.name}`);
            client.commands.set(command.name, command);
            
            // Register slash command if available
            if (command.slashCommand) {
                client.slashCommands.set(command.name, command);
            }
        }
    }
};

// Load events
const loadEvents = () => {
    const eventFiles = fs.readdirSync(path.join(__dirname, 'events'))
        .filter(file => file.endsWith('.js'));
    
    for (const file of eventFiles) {
        const event = require(path.join(__dirname, 'events', file));
        const eventName = file.split('.')[0];
        
        logger.info(`Loading event: ${eventName}`);
        
        if (event.once) {
            client.once(eventName, (...args) => event.execute(...args, client));
        } else {
            client.on(eventName, (...args) => event.execute(...args, client));
        }
    }
};

// Load commands and events
loadCommands('commands');
loadEvents();

// Login to Discord
client.login(process.env.DISCORD_BOT_TOKEN)
    .then(() => {
        logger.info('Bot successfully logged in');
    })
    .catch(error => {
        logger.error('Failed to login:', error);
        process.exit(1);
    });

// Handle process errors
process.on('unhandledRejection', error => {
    logger.error('Unhandled promise rejection:', error);
});