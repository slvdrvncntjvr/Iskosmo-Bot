// copyright aoz
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
const MemoryManager = require('./utils/memoryManager');
const deviceManager = require('./utils/deviceManager');
const CommandOptimizer = require('./utils/commandOptimizer');
const killSwitch = require('./utils/killSwitch');

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

killSwitch.initialize(client);

client.commands = new Collection();
client.slashCommands = new Collection();
client.memoryManager = new MemoryManager(client);
client.commandOptimizer = new CommandOptimizer(client);

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

// memory pressure detection
setInterval(() => {
    try {
      const memoryUsage = process.memoryUsage();
      const memoryUsagePercent = (memoryUsage.heapUsed / memoryUsage.heapTotal) * 100;
      
      if (memoryUsagePercent > 85) {
        console.warn(`[MEMORY WARNING] High memory usage: ${memoryUsagePercent.toFixed(1)}%`);
        
        // Use the memory manager to handle high memory situations
        if (client.memoryManager) {
          client.memoryManager.checkMemoryUsage();
          client.memoryManager.performMemoryCleanup(memoryUsagePercent > 90);
        }
        
        if (global.gc) {
          console.log('Forcing garbage collection...');
          global.gc();
        }
      }
    } catch (error) {
      console.error('Error checking memory:', error);
    }
  }, 60000); 

setInterval(() => {
    deviceManager.checkDeviceStatus();
}, 15 * 60 * 1000);

deviceManager.checkDeviceStatus();

process.on('unhandledRejection', error => {
    logger.error('Unhandled promise rejection:', error);
    
    if (error.message && (
        error.message.includes('memory') || 
        error.message.includes('heap') ||
        error.message.includes('allocation')
    )) {
        logger.warn('Memory-related error detected, forcing cleanup');
        if (client.memoryManager) {
            client.memoryManager.performMemoryCleanup(true);
        }
    }
});

const { startHealthServer } = require('./utils/healthCheck');
startHealthServer(3000); // http://localhost:3000/health

process.on('SIGTERM', gracefulShutdown);
process.on('SIGINT', gracefulShutdown);

async function gracefulShutdown() {
    logger.info('Shutdown signal received, cleaning up...');
    
    try {
        logger.info('Destroying client connection...');
        await client.destroy();
        logger.info('Shutdown complete');
    } catch (error) {
        logger.error('Error during shutdown:', error);
    }
    
    process.exit(0);
}

// Facebook post checker
async function checkFacebookPosts() {
    try {
        const fbSettingsPath = path.join(__dirname, 'data/facebookSettings.json');
        if (!fs.existsSync(fbSettingsPath)) {
            return;
        }

        const fbSettings = JSON.parse(fs.readFileSync(fbSettingsPath, 'utf8'));
        const currentTime = Date.now();
        
        for (const [guildId, settings] of Object.entries(fbSettings)) {
            // Skip if autopost is disabled or missing required settings
            if (!settings.autopost || !settings.channelId || (!settings.defaultPage && !process.env.FACEBOOK_DEFAULT_PAGE)) {
                continue;
            }
            
            // Check if it's time to check based on interval
            const interval = settings.interval || 30; // Default 30 minutes
            const lastCheck = settings.lastCheckTime || 0;
            const intervalMs = interval * 60 * 1000;
            
            if (currentTime - lastCheck < intervalMs) {
                continue;
            }
            
            // Update last check time
            settings.lastCheckTime = currentTime;
            fs.writeFileSync(fbSettingsPath, JSON.stringify(fbSettings, null, 2), 'utf8');
            
            // Try to get the guild and channel
            const guild = client.guilds.cache.get(guildId);
            if (!guild) continue;
            
            const channel = guild.channels.cache.get(settings.channelId);
            if (!channel) continue;
            
            // Get the pageId to check
            const pageId = settings.defaultPage || process.env.FACEBOOK_DEFAULT_PAGE;
            const getpostCommand = client.commands.get('getpost');
            
            if (!getpostCommand) {
                logger.error('Facebook post checker: getpost command not found');
                continue;
            }
            
            // Fetch the most recent post
            const posts = await getpostCommand.fetchPosts(pageId, 1);
            if (!posts || !posts.length) continue;
            
            const latestPost = posts[0];
            
            // Check if we've already posted this
            const latestPostTime = new Date(latestPost.created_time).getTime();
            const lastPostedTime = settings.lastPostTime || 0;
            
            // Only post if it's newer than our last posted time
            if (latestPostTime > lastPostedTime) {
                const pageName = await getpostCommand.getPageName(pageId);
                const embed = await getpostCommand.createPostEmbed(latestPost, pageName);
                
                await channel.send({ 
                    content: '📢 **New Facebook Post!**',
                    embeds: [embed] 
                });
                
                // Update last post time
                settings.lastPostTime = latestPostTime;
                fs.writeFileSync(fbSettingsPath, JSON.stringify(fbSettings, null, 2), 'utf8');
                
                logger.info(`Posted new Facebook update to ${guild.name} #${channel.name}`);
            }
        }
    } catch (error) {
        logger.error('Error in Facebook post checker:', error);
    }
}

// Run the Facebook post checker every 5 minutes
setInterval(checkFacebookPosts, 5 * 60 * 1000);

// Initial check a minute after startup
setTimeout(checkFacebookPosts, 60 * 1000);
