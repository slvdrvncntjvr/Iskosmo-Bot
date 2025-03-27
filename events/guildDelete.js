const { ActivityType } = require('discord.js');
const logger = require('../utils/logger');

module.exports = {
    once: false,
    async execute(guild, client) {
        const guildCount = client.guilds.cache.size;

        client.user.setPresence({
            activities: [
                {
                    name: `in ${guildCount} guilds`,
                    type: ActivityType.Playing
                }
            ],
            status: 'online'
        });
        
        logger.info(`Left guild: ${guild.name} (ID: ${guild.id}). Now serving ${guildCount} guilds.`);
        logger.logToDiscord(client, `Left guild: ${guild.name} (ID: ${guild.id}). Now serving ${guildCount} guilds.`);
    },
};