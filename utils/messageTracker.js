
const { Collection } = require('discord.js');

class MessageTracker {
    constructor() {
        this.deletedMessages = new Collection();
        this.expiryTime = 10 * 60 * 1000;
    }
    
    /**
     * store a deleted message
     * @param {Message} message The deleted message object
     */
    trackDeletedMessage(message) {
        if (message.author.bot || (!message.content && message.attachments.size === 0)) return;
        
        const channelId = message.channel.id;

        this.deletedMessages.set(channelId, {
            content: message.content,
            author: {
                id: message.author.id,
                tag: message.author.tag,
                avatarURL: message.author.displayAvatarURL({ dynamic: true })
            },
            attachments: message.attachments.size > 0 ? 
                Array.from(message.attachments.values()).map(a => a.url) : [],
            createdAt: message.createdAt,
            deletedAt: new Date(),
            embeds: message.embeds.length > 0 ? message.embeds : []
        });
        
        setTimeout(() => {
            const current = this.deletedMessages.get(channelId);
            if (current && current.deletedAt === this.deletedMessages.get(channelId)?.deletedAt) {
                this.deletedMessages.delete(channelId);
            }
        }, this.expiryTime);
    }
    
    /**
     * get the most recently deleted message in a channel
     * @param {string} channelId The channel ID
     * @returns {Object|null} The deleted message data or null
     */
    getDeletedMessage(channelId) {
        return this.deletedMessages.get(channelId) || null;
    }
    
    /**
     * clear deleted message data for a channel
     * @param {string} channelId The channel ID
     */
    clearDeletedMessage(channelId) {
        this.deletedMessages.delete(channelId);
    }
}

module.exports = new MessageTracker();