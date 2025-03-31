global.opus = require('opusscript');
process.env.YTDL_NO_UPDATE = "true";
process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";
require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { Client, GatewayIntentBits, Collection, Partials } = require('discord.js');
const logger = require('./utils/logger');
const config = require('./config');
const { findPackageJSON } = require('module');

// create data directory if it doesn't exist
const dataDir = path.join(__dirname, 'data');
if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
}

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.GuildMessageReactions,
        GatewayIntentBits.GuildVoiceStates
    ],
    partials: [
        Partials.Message,
        Partials.Channel,
        Partials.Reaction
    ],

    resetTimeOffset: 0,
    failIfNotExists: false,
    shards: 'auto',
    allowedMentions: { parse: ['users', 'roles'], repliedUser: false },
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
    for (const command of client.commands.values()) {
        if (config.restrictedCommands.includes(command.name)) {
            command.requiresAuth = true;
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

setInterval(() => {
    const memoryUsage = process.memoryUsage();
    logger.info(`Memory usage: ${Math.round(memoryUsage.heapUsed / 1024 / 1024)} MB`);

    if (memoryUsage.heapUsed > 500 * 1024 * 1024) { 
        logger.warn('High memory usage detected, potential memory leak');
    }
}, 30 * 60 * 1000);