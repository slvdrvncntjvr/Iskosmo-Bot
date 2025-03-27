const { ActivityType } = require('discord.js');
const logger = require('./logger');

class StatusManager {
    constructor(client) {
        this.client = client;
        this.statusIndex = 0;
        this.interval = null;
    }
    
    startRotation() {
        // Clear any existing interval
        if (this.interval) {
            clearInterval(this.interval);
        }

        this.updateStatus();

        this.interval = setInterval(() => {
            this.statusIndex = (this.statusIndex + 1) % this.getStatusOptions().length;
            this.updateStatus();
        }, 5 * 60 * 1000); 
        
        logger.info('Status rotation started');
    }

    stopRotation() {
        if (this.interval) {
            clearInterval(this.interval);
            this.interval = null;
            logger.info('Status rotation stopped');
        }
    }

    getStatusOptions() {
        const guildCount = this.client.guilds.cache.size;
        const userCount = this.client.guilds.cache.reduce((acc, guild) => acc + guild.memberCount, 0);
        
        return [
            {
                name: `in ${guildCount} guilds`,
                type: ActivityType.Playing
            },
            {
                name: `with ${userCount} users`,
                type: ActivityType.Playing
            },
            {
                name: `!help for commands`,
                type: ActivityType.Listening
            },
            {
                name: `${this.client.guilds.cache.size} servers`,
                type: ActivityType.Watching
            }
        ];
    }

    updateStatus() {
        const statusOptions = this.getStatusOptions();
        const currentStatus = statusOptions[this.statusIndex];
        
        this.client.user.setPresence({
            activities: [currentStatus],
            status: 'online'
        });
        
        logger.info(`Updated status to: ${ActivityType[currentStatus.type]} ${currentStatus.name}`);
    }
}

module.exports = StatusManager;