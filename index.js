process.env.YTDL_NO_UPDATE = "true";
process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";
require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { Client, GatewayIntentBits, Collection } = require('discord.js');
const config = require('./config');
const logger = require('./utils/logger');

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildMembers,
    ]
});

client.commands = new Collection();
client.slashCommands = new Collection();

const loadCommands = (dir) => {
    const commandFolders = fs.readdirSync(path.join(__dirname, dir));
    
    for (const folder of commandFolders) {
        const commandFiles = fs.readdirSync(path.join(__dirname, dir, folder))
            .filter(file => file.endsWith('.js'));
        
        for (const file of commandFiles) {
            const command = require(path.join(__dirname, dir, folder, file));
            logger.info(`Loading command: ${command.name}`);
            client.commands.set(command.name, command);
    
            if (command.slashCommand) {
                client.slashCommands.set(command.name, command);
            }
        }
    }
};

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

loadCommands('commands');
loadEvents();

client.login(process.env.DISCORD_BOT_TOKEN)
    .then(() => {
        logger.info('Bot successfully logged in');
    })
    .catch(error => {
        logger.error('Failed to login:', error);
        process.exit(1);
    });

process.on('unhandledRejection', error => {
    logger.error('Unhandled promise rejection:', error);
});