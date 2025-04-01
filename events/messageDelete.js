const messageTracker = require('../utils/messageTracker');
const logger = require('../utils/logger');

module.exports = {
    once: false,
    execute(message, client) {
            messageTracker.trackDeletedMessage(message);
    },
};