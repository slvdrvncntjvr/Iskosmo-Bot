const messageTracker = require('../utils/messageTracker');
const logger = require('../utils/logger');

module.exports = {
    once: false,
    async execute(message, client) {
        try {
            if (message.partial) return;

            messageTracker.trackDeletedMessage(message);

            logger.info(`Message by ${message.author?.tag || 'Unknown'} was deleted in #${message.channel.name}`);
        } catch (error) {
            logger.error('Error in messageDelete event:', error);
        }
    },
};