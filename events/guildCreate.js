const { ActivityType } = require('discord.js');
const logger = require('../utils/logger');

module.exports = {
    once: false,
    async execute(guild, client) {
        const actualClient = client || guild.client;
        const guildCount = actualClient.guilds.cache.size;

        if (actualClient.statusManager) {
            actualClient.statusManager.updateGuildCount();
        }
        
        const eventType = 'Joined';
        logger.info(`Joined new guild: ${guild.name} (ID: ${guild.id}). Now serving ${guildCount} guilds.`);
        logger.logToDiscord(client, `Joined new guild: ${guild.name} (ID: ${guild.id}). Now serving ${guildCount} guilds.`);
    },
};