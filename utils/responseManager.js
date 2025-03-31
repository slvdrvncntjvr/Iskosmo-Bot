const fs = require('fs');
const path = require('path');
const logger = require('./logger');

class ResponseManager {
    constructor() {
        this.responsesPath = path.join(__dirname, '../data/autoResponses.json');
        this.reactsPath = path.join(__dirname, '../data/autoReacts.json');
        this.responses = new Map(); 
        this.reacts = new Map();    
        this.loadData();
    }

    loadData() {
        try {
            if (fs.existsSync(this.responsesPath)) {
                const rawData = fs.readFileSync(this.responsesPath, 'utf8');
                const parsed = JSON.parse(rawData);
                
                Object.keys(parsed).forEach(guildId => {
                    this.responses.set(guildId, parsed[guildId]);
                });
                
                logger.info(`Loaded ${this.getTotalResponseCount()} auto-responses across ${this.responses.size} guilds`);
            } else {
                fs.writeFileSync(this.responsesPath, JSON.stringify({}), 'utf8');
                logger.info('Created empty auto-responses file');
            }

            if (fs.existsSync(this.reactsPath)) {
                const rawData = fs.readFileSync(this.reactsPath, 'utf8');
                const parsed = JSON.parse(rawData);
                
                Object.keys(parsed).forEach(guildId => {
                    this.reacts.set(guildId, parsed[guildId]);
                });
                
                logger.info(`Loaded ${this.getTotalReactCount()} auto-reactions across ${this.reacts.size} guilds`);
            } else {
                fs.writeFileSync(this.reactsPath, JSON.stringify({}), 'utf8');
                logger.info('Created empty auto-reactions file');
            }
        } catch (error) {
            logger.error('Error loading response data:', error);
            this.responses = new Map();
            this.reacts = new Map();
        }
    }

    saveResponses() {
        try {
            const data = {};
            for (const [guildId, responses] of this.responses.entries()) {
                data[guildId] = responses;
            }
            
            fs.writeFileSync(this.responsesPath, JSON.stringify(data, null, 2), 'utf8');
            logger.info(`Saved ${this.getTotalResponseCount()} auto-responses`);
            return true;
        } catch (error) {
            logger.error('Error saving auto-responses:', error);
            return false;
        }
    }

    saveReacts() {
        try {
            const data = {};
            for (const [guildId, reacts] of this.reacts.entries()) {
                data[guildId] = reacts;
            }
            
            fs.writeFileSync(this.reactsPath, JSON.stringify(data, null, 2), 'utf8');
            logger.info(`Saved ${this.getTotalReactCount()} auto-reactions`);
            return true;
        } catch (error) {
            logger.error('Error saving auto-reactions:', error);
            return false;
        }
    }

    getResponses(guildId) {
        return this.responses.get(guildId) || [];
    }

    getReacts(guildId) {
        return this.reacts.get(guildId) || [];
    }

    addResponse(guildId, trigger, response, options = {}) {
        if (!this.responses.has(guildId)) {
            this.responses.set(guildId, []);
        }
        
        const guildResponses = this.responses.get(guildId);
        const existingIndex = guildResponses.findIndex(r => 
            r.trigger.toLowerCase() === trigger.toLowerCase());
        
        const responseObj = {
            trigger,
            response,
            createdAt: new Date().toISOString(),
            createdBy: options.createdBy || 'Unknown',
            matchType: options.matchType || 'contains', 
            caseSensitive: options.caseSensitive || false,
            allowedChannels: options.allowedChannels || [], 
            ignoredUsers: options.ignoredUsers || [], 
            cooldown: options.cooldown || 0,
            lastTriggered: null, 
            enabled: true
        };
        
        if (existingIndex >= 0) {
            guildResponses[existingIndex] = responseObj;
        } else {
            guildResponses.push(responseObj);
        }
        
        this.saveResponses();
        return existingIndex >= 0 ? 'updated' : 'added';
    }

    // Add a new auto-reaction
    addReact(guildId, trigger, emoji, options = {}) {
        if (!this.reacts.has(guildId)) {
            this.reacts.set(guildId, []);
        }
        
        const guildReacts = this.reacts.get(guildId);
        
        // Check if trigger already exists with the same emoji
        const existingIndex = guildReacts.findIndex(r => 
            r.trigger.toLowerCase() === trigger.toLowerCase() && r.emoji === emoji);
        
        const reactObj = {
            trigger,
            emoji,
            createdAt: new Date().toISOString(),
            createdBy: options.createdBy || 'Unknown',
            matchType: options.matchType || 'contains', // 'contains', 'exact', 'startsWith', 'endsWith'
            caseSensitive: options.caseSensitive || false,
            allowedChannels: options.allowedChannels || [], // Empty means all channels
            ignoredUsers: options.ignoredUsers || [], // Users to ignore
            cooldown: options.cooldown || 0, // Cooldown in seconds, 0 means no cooldown
            lastTriggered: null, // Will be set when triggered
            enabled: true
        };
        
        if (existingIndex >= 0) {
            guildReacts[existingIndex] = reactObj;
        } else {
            guildReacts.push(reactObj);
        }
        
        this.saveReacts();
        return existingIndex >= 0 ? 'updated' : 'added';
    }

    // Remove an auto-response
    removeResponse(guildId, trigger) {
        if (!this.responses.has(guildId)) return false;
        
        const guildResponses = this.responses.get(guildId);
        const initialLength = guildResponses.length;
        
        const newResponses = guildResponses.filter(r => 
            r.trigger.toLowerCase() !== trigger.toLowerCase());
        
        if (newResponses.length < initialLength) {
            this.responses.set(guildId, newResponses);
            this.saveResponses();
            return true;
        }
        
        return false;
    }

    // Remove an auto-reaction
    removeReact(guildId, trigger, emoji = null) {
        if (!this.reacts.has(guildId)) return false;
        
        const guildReacts = this.reacts.get(guildId);
        const initialLength = guildReacts.length;
        
        let newReacts;
        if (emoji) {
            // Remove specific trigger+emoji combination
            newReacts = guildReacts.filter(r => 
                !(r.trigger.toLowerCase() === trigger.toLowerCase() && r.emoji === emoji));
        } else {
            // Remove all reactions with this trigger
            newReacts = guildReacts.filter(r => 
                r.trigger.toLowerCase() !== trigger.toLowerCase());
        }
        
        if (newReacts.length < initialLength) {
            this.reacts.set(guildId, newReacts);
            this.saveReacts();
            return true;
        }
        
        return false;
    }

    // Toggle enabled status of an auto-response
    toggleResponse(guildId, trigger) {
        if (!this.responses.has(guildId)) return false;
        
        const guildResponses = this.responses.get(guildId);
        const response = guildResponses.find(r => 
            r.trigger.toLowerCase() === trigger.toLowerCase());
        
        if (response) {
            response.enabled = !response.enabled;
            this.saveResponses();
            return response.enabled;
        }
        
        return false;
    }

    // Toggle enabled status of an auto-reaction
    toggleReact(guildId, trigger, emoji) {
        if (!this.reacts.has(guildId)) return false;
        
        const guildReacts = this.reacts.get(guildId);
        const react = guildReacts.find(r => 
            r.trigger.toLowerCase() === trigger.toLowerCase() && r.emoji === emoji);
        
        if (react) {
            react.enabled = !react.enabled;
            this.saveReacts();
            return react.enabled;
        }
        
        return false;
    }

    // Check if a message should trigger an auto-response
    checkForAutoResponse(message) {
        if (!message.guild) return null;
        
        const guildId = message.guild.id;
        const guildResponses = this.getResponses(guildId);
        
        if (!guildResponses.length) return null;
        
        const content = message.content;
        const channelId = message.channel.id;
        const userId = message.author.id;
        const now = Date.now();
        
        for (const response of guildResponses) {
            // Skip disabled responses
            if (!response.enabled) continue;
            
            // Check channel restrictions
            if (response.allowedChannels.length > 0 && !response.allowedChannels.includes(channelId)) {
                continue;
            }
            
            // Check user ignores
            if (response.ignoredUsers.includes(userId)) {
                continue;
            }
            
            // Check cooldown
            if (response.cooldown > 0 && response.lastTriggered) {
                const cooldownMs = response.cooldown * 1000;
                const timeSinceLastTrigger = now - new Date(response.lastTriggered).getTime();
                if (timeSinceLastTrigger < cooldownMs) {
                    continue;
                }
            }
            
            // Check if message matches trigger
            if (this.messageMatchesTrigger(content, response.trigger, response.matchType, response.caseSensitive)) {
                // Update last triggered time
                response.lastTriggered = new Date().toISOString();
                this.saveResponses();
                
                return response.response;
            }
        }
        
        return null;
    }

    checkForAutoReactions(message) {
        if (!message.guild) return [];
        
        const guildId = message.guild.id;
        const guildReacts = this.getReacts(guildId);
        
        if (!guildReacts.length) return [];
        
        const content = message.content;
        const channelId = message.channel.id;
        const userId = message.author.id;
        const now = Date.now();
        const matchedReactions = [];
        
        for (const react of guildReacts) {
            if (!react.enabled) continue;

            if (react.allowedChannels.length > 0 && !react.allowedChannels.includes(channelId)) {
                continue;
            }

            if (react.ignoredUsers.includes(userId)) {
                continue;
            }

            if (react.cooldown > 0 && react.lastTriggered) {
                const cooldownMs = react.cooldown * 1000;
                const timeSinceLastTrigger = now - new Date(react.lastTriggered).getTime();
                if (timeSinceLastTrigger < cooldownMs) {
                    continue;
                }
            }
            
            // Check if message matches trigger
            if (this.messageMatchesTrigger(content, react.trigger, react.matchType, react.caseSensitive)) {
                // Update last triggered time
                react.lastTriggered = new Date().toISOString();
                matchedReactions.push(react.emoji);
            }
        }
        
        if (matchedReactions.length > 0) {
            this.saveReacts();
        }
        
        return matchedReactions;
    }

    // Helper to check if a message matches a trigger based on match type
    messageMatchesTrigger(message, trigger, matchType, caseSensitive) {
        if (!caseSensitive) {
            message = message.toLowerCase();
            trigger = trigger.toLowerCase();
        }
        
        switch (matchType) {
            case 'exact':
                return message === trigger || 
                       message.split(/\s+/).includes(trigger);
            case 'startsWith':
                return message.startsWith(trigger) || 
                       message.split(/\s+/).some(word => word.startsWith(trigger));
            case 'endsWith':
                return message.endsWith(trigger) || 
                       message.split(/\s+/).some(word => word.endsWith(trigger));
            case 'contains':
            default:
                return message.includes(trigger);
        }
    }

    listResponses(guildId) {
        return this.getResponses(guildId);
    }

    listReacts(guildId) {
        return this.getReacts(guildId);
    }

    getResponseDetails(guildId, trigger) {
        const responses = this.getResponses(guildId);
        return responses.find(r => r.trigger.toLowerCase() === trigger.toLowerCase()) || null;
    }

    getReactDetails(guildId, trigger, emoji) {
        const reacts = this.getReacts(guildId);
        return reacts.find(r => 
            r.trigger.toLowerCase() === trigger.toLowerCase() && r.emoji === emoji) || null;
    }

    getTotalResponseCount() {
        let count = 0;
        for (const responses of this.responses.values()) {
            count += responses.length;
        }
        return count;
    }

    getTotalReactCount() {
        let count = 0;
        for (const reacts of this.reacts.values()) {
            count += reacts.length;
        }
        return count;
    }
}

module.exports = new ResponseManager();