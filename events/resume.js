const logger = require('../utils/logger');

module.exports = {
    once: false,
    async execute(client) {
        logger.info('Discord connection resumed');
        
        if (client.statusManager) {
            logger.info('Recovering status after reconnection');
            setTimeout(() => {
                client.statusManager.setDefaultStatus();
            }, 5000); 
        }
    },
};