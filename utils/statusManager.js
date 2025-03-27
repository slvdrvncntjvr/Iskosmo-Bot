const { ActivityType } = require('discord.js');
const logger = require('./logger');

class StatusManager {
    constructor(client) {
        this.client = client;
        this.defaultStatus = true;
    }

    setDefaultStatus() {
        const guildCount = this.client.guilds.cache.size;
        
        this.client.user.setPresence({
            activities: [{
                name: `in ${guildCount} guilds`,
                type: ActivityType.Playing
            }],
            status: 'online'
        });
        
        this.defaultStatus = true;
        logger.info(`Set default status: Playing in ${guildCount} guilds`);
    }

    setTemporaryStatus(statusText, duration, activityType = ActivityType.Playing) {
        if (this.statusTimeout) {
            clearTimeout(this.statusTimeout);
        }

        this.client.user.setPresence({
            activities: [{
                name: statusText,
                type: activityType
            }],
            status: 'online'
        });
        
        this.defaultStatus = false;
        logger.info(`Temporary status set: "${ActivityType[activityType]} ${statusText}" for ${duration} seconds`);
        
        this.statusTimeout = setTimeout(() => {
            this.setDefaultStatus();
        }, duration * 1000);
    }

    updateGuildCount() {
        if (this.defaultStatus) {
            this.setDefaultStatus();
        }
    }
}

module.exports = StatusManager;