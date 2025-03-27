const { createLogger, format, transports } = require('winston');
const { combine, timestamp, printf, colorize } = format;
const fs = require('fs');
const path = require('path');

if (!fs.existsSync('logs')) {
    fs.mkdirSync('logs');
}

const logFormat = printf(({ level, message, timestamp }) => {
    return `[${timestamp}] ${level}: ${message}`;
});

const logger = createLogger({
    level: 'info',
    format: combine(
        timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
        logFormat
    ),
    transports: [
        new transports.Console({
            format: combine(
                colorize(),
                timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
                logFormat
            )
        }),
        new transports.File({ filename: 'logs/error.log', level: 'error' }),
        new transports.File({ filename: 'logs/combined.log' })
    ]
});

logger.logToDiscord = async (client, message, level = 'info') => {
    try {
        // Get log settings
        const LOG_SETTINGS_PATH = path.join(__dirname, '../data/logSettings.json');
        if (!fs.existsSync(LOG_SETTINGS_PATH)) {
            return; // No settings file exists yet
        }
        
        const logSettings = JSON.parse(fs.readFileSync(LOG_SETTINGS_PATH, 'utf8'));

        for (const [guildId, channelId] of Object.entries(logSettings)) {
            const guild = client.guilds.cache.get(guildId);
            if (!guild) continue;
            
            const channel = guild.channels.cache.get(channelId);
            if (!channel) continue;
            
            // Format the log message with timestamp
            const timestamp = new Date().toISOString().replace('T', ' ').slice(0, 19);
            const logMessage = `[${timestamp}] ${level.toUpperCase()}: ${message}`;
            
            await channel.send({
                content: `\`\`\`\n${logMessage}\n\`\`\``
            });
        }
    } catch (error) {
        console.error('Failed to log to Discord:', error);
    }
};

module.exports = logger;