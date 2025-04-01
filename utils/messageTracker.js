const logger = require('./logger');

class MessageTracker {
    constructor() {
        this.deletedMessages = new Map(); 
        this.maxTrackedMessages = 10; 
        this.messageExpiryTime = 30 * 60 * 1000; 
        this.lastCleanup = Date.now();
        this.cleanupInterval = 10 * 60 * 1000; 
        this.logDeletions = false;
    }

    /**
     * Track a deleted message
     * @param {Object} message - The Discord.js message object that was deleted
     */
    trackDeletedMessage(message) {
        try {
            if (message.author.bot || !message.content) return;
            
            const channelId = message.channel.id;

            if (!this.deletedMessages.has(channelId)) {
                this.deletedMessages.set(channelId, []);
            }
            
            const channelMessages = this.deletedMessages.get(channelId);

            channelMessages.unshift({
                content: message.content,
                author: {
                    id: message.author.id,
                    username: message.author.username,
                    discriminator: message.author.discriminator,
                    avatar: message.author.displayAvatarURL({ dynamic: true })
                },
                timestamp: Date.now(),
                attachments: message.attachments.map(a => ({
                    url: a.url,
                    name: a.name,
                    contentType: a.contentType
                }))
            });

            if (channelMessages.length > this.maxTrackedMessages) {
                channelMessages.pop(); 
            }

            if (this.logDeletions) {
                logger.info(`Message by ${message.author.tag} was deleted in #${message.channel.name}`);
            }

            this.maybeCleanupOldMessages();
            
        } catch (error) {
            logger.error('Error tracking deleted message:', error);
        }
    }

    /**
     * Get the most recently deleted message from a channel
     * @param {string} channelId - The channel ID to retrieve from
     * @param {number} index - Optional index to retrieve (0 = most recent)
     * @returns {Object|null} The deleted message or null if none found
     */
    getDeletedMessage(channelId, index = 0) {
        if (!this.deletedMessages.has(channelId)) {
            return null;
        }
        
        const channelMessages = this.deletedMessages.get(channelId);
        
        if (index < 0 || index >= channelMessages.length) {
            return null;
        }
        
        return channelMessages[index];
    }

    /**
     * Get all tracked channels that have deleted messages
     * @returns {Array} Array of channel IDs
     */
    getTrackedChannels() {
        return Array.from(this.deletedMessages.keys());
    }

    /**
     * Get the number of deleted messages tracked for a channel
     * @param {string} channelId - The channel ID to check
     * @returns {number} The number of tracked messages
     */
    getDeletedMessageCount(channelId) {
        if (!this.deletedMessages.has(channelId)) {
            return 0;
        }
        
        return this.deletedMessages.get(channelId).length;
    }
  
    maybeCleanupOldMessages() {
        const now = Date.now();

        if (now - this.lastCleanup < this.cleanupInterval) {
            return;
        }
        
        this.lastCleanup = now;
        let removedCount = 0;
        
        for (const [channelId, messages] of this.deletedMessages.entries()) {
            const newMessages = messages.filter(msg => {
                const isExpired = now - msg.timestamp > this.messageExpiryTime;
                if (isExpired) removedCount++;
                return !isExpired;
            });
            
            if (newMessages.length === 0) {
                this.deletedMessages.delete(channelId);
            } else if (newMessages.length < messages.length) {
                this.deletedMessages.set(channelId, newMessages);
            }
        }
        
        if (removedCount > 0) {
            logger.debug(`Cleaned up ${removedCount} expired deleted messages`);
        }
    }

   
checkMemoryUsage(force = false) {

    if (!force && Date.now() - this.lastCleanup < this.cleanupInterval) {
        return;
    }
    
    if (global.gc && process.memoryUsage) {
        global.gc();

        const memoryUsage = process.memoryUsage();
        const memoryRatio = memoryUsage.heapUsed / memoryUsage.heapTotal;
 
        if (memoryRatio > 0.8) {
            this.messageExpiryTime = 15 * 60 * 1000; 
            this.maxTrackedMessages = 5;
            
            this.cleanupOldMessages(true);
            
            logger.warn(`High memory usage (${(memoryRatio * 100).toFixed(1)}%), reduced message tracking scope`);
        }
    }
}

cleanupOldMessages(aggressive = false) {
    const now = Date.now();
    this.lastCleanup = now;
    let removedCount = 0;
    
    for (const [channelId, messages] of this.deletedMessages.entries()) {
        let newMessages;
        
        if (aggressive) {
            newMessages = messages.slice(0, 1);
            removedCount += messages.length - newMessages.length;
        } else {
            newMessages = messages.filter(msg => {
                const isExpired = now - msg.timestamp > this.messageExpiryTime;
                if (isExpired) removedCount++;
                return !isExpired;
            });
        }
        
        if (newMessages.length === 0) {
            this.deletedMessages.delete(channelId);
        } else if (newMessages.length < messages.length) {
            this.deletedMessages.set(channelId, newMessages);
        }
    }
    
    if (removedCount > 0) {
        if (this.logDeletions) {
            logger.debug(`Cleaned up ${removedCount} expired deleted messages`);
        }
            }
        }

        maybeCleanupOldMessages() {
            this.checkMemoryUsage();
        }
}

module.exports = new MessageTracker();