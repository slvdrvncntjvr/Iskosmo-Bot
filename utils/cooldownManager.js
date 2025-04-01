const fs = require('fs');
const path = require('path');
const logger = require('./logger');

class CooldownManager {
    constructor() {
        this.cooldownsPath = path.join(__dirname, '../data/cooldowns.json');
        this.cooldowns = {
            global: {},
            guilds: {}  
        };
        this.activeCooldowns = new Map(); 
        this.lastCleanup = Date.now();
        this.cleanupInterval = 5 * 60 * 1000; 
        this.loadCooldowns();
        this.memoryPressureThreshold = 0.85; 
        this.lastMemoryCheck = Date.now();
        this.memoryCheckInterval = 60 * 1000; 
    }

    loadCooldowns() {
        try {
            if (fs.existsSync(this.cooldownsPath)) {
                const data = fs.readFileSync(this.cooldownsPath, 'utf8');
                const parsed = JSON.parse(data);
                
                this.cooldowns = parsed;

                if (!this.cooldowns.global) this.cooldowns.global = {};
                if (!this.cooldowns.guilds) this.cooldowns.guilds = {};
                
                logger.info(`Loaded cooldown settings: ${Object.keys(this.cooldowns.global).length} global, ${Object.keys(this.cooldowns.guilds).length} guild-specific`);
            } else {
                this.cooldowns = {
                    global: {
                        ping: 5,
                        joke: 5,      
                        getvid: 10,   
                        debug: 30,     
                        announce: 60   
                    },
                    guilds: {}
                };
                this.saveCooldowns();
                logger.info('Created default cooldown settings');
            }
        } catch (error) {
            logger.error('Error loading cooldown settings:', error);
            this.cooldowns = { global: {}, guilds: {} };
        }
    }

    saveCooldowns() {
        try {
            fs.writeFileSync(this.cooldownsPath, JSON.stringify(this.cooldowns, null, 2), 'utf8');
            return true;
        } catch (error) {
            logger.error('Error saving cooldown settings:', error);
            return false;
        }
    }

    getCooldownDuration(commandName, guildId) {
        if (guildId && 
            this.cooldowns.guilds[guildId] && 
            this.cooldowns.guilds[guildId][commandName] !== undefined) {
            return this.cooldowns.guilds[guildId][commandName];
        }

        return this.cooldowns.global[commandName] || 0;
    }

    setCooldownDuration(commandName, duration, guildId = null) {
        if (duration < 0) return false;
        
        if (guildId) {
            if (!this.cooldowns.guilds[guildId]) {
                this.cooldowns.guilds[guildId] = {};
            }
            this.cooldowns.guilds[guildId][commandName] = duration;
        } else {
            this.cooldowns.global[commandName] = duration;
        }
        
        return this.saveCooldowns();
    }

    removeCooldownDuration(commandName, guildId = null) {
        let success = false;
        
        if (guildId) {
            if (this.cooldowns.guilds[guildId] && 
                this.cooldowns.guilds[guildId][commandName] !== undefined) {
                delete this.cooldowns.guilds[guildId][commandName];
                success = true;
            }
        } else {
            if (this.cooldowns.global[commandName] !== undefined) {
                delete this.cooldowns.global[commandName];
                success = true;
            }
        }
        
        if (success) {
            this.saveCooldowns();
        }
        
        return success;
    }

    getCooldownKey(commandName, userId, guildId) {
        return `${commandName}:${userId}:${guildId || 'global'}`;
    }

    checkCooldown(commandName, userId, guildId) {
        const duration = this.getCooldownDuration(commandName, guildId);
        if (duration <= 0) return 0; 

        const key = this.getCooldownKey(commandName, userId, guildId);
        const cooldown = this.activeCooldowns.get(key);
        
        if (!cooldown) return 0; 
        
        const now = Date.now();
        const expiresAt = cooldown.timestamp + (duration * 1000);
        
        if (now >= expiresAt) {
            this.activeCooldowns.delete(key);
            return 0;
        }

        return Math.ceil((expiresAt - now) / 1000);
    }

    setCooldown(commandName, userId, guildId) {
        const duration = this.getCooldownDuration(commandName, guildId);
        if (duration <= 0) return false;

        const key = this.getCooldownKey(commandName, userId, guildId);
        this.activeCooldowns.set(key, {
            timestamp: Date.now(),
            commandName,
            userId,
            guildId
        });
        
        this.maybeCleanupExpired();
        
        return true;
    }

    resetCooldown(commandName, userId, guildId) {
        const key = this.getCooldownKey(commandName, userId, guildId);
        return this.activeCooldowns.delete(key);
    }

    resetUserCooldowns(userId) {
        let count = 0;
        
        for (const [key, cooldown] of this.activeCooldowns.entries()) {
            if (cooldown.userId === userId) {
                this.activeCooldowns.delete(key);
                count++;
            }
        }
        
        return count;
    }

    resetGuildCooldowns(guildId) {
        let count = 0;
        
        for (const [key, cooldown] of this.activeCooldowns.entries()) {
            if (cooldown.guildId === guildId) {
                this.activeCooldowns.delete(key);
                count++;
            }
        }
        
        return count;
    }

    resetAllCooldowns() {
        const count = this.activeCooldowns.size;
        this.activeCooldowns.clear();
        return count;
    }

    listCooldowns(guildId) {
        const result = {};
        
        for (const [command, duration] of Object.entries(this.cooldowns.global)) {
            result[command] = {
                duration,
                source: 'global',
                overridden: false
            };
        }
        
        if (guildId && this.cooldowns.guilds[guildId]) {
            for (const [command, duration] of Object.entries(this.cooldowns.guilds[guildId])) {
                result[command] = {
                    duration,
                    source: 'guild',
                    overridden: this.cooldowns.global[command] !== undefined
                };
            }
        }
        
        return result;
    }

    getUserActiveCooldowns(userId, guildId = null) {
        const now = Date.now();
        const result = [];
        
        for (const [key, cooldown] of this.activeCooldowns.entries()) {
            if (cooldown.userId === userId && (!guildId || cooldown.guildId === guildId)) {
                const duration = this.getCooldownDuration(cooldown.commandName, cooldown.guildId);
                const expiresAt = cooldown.timestamp + (duration * 1000);
                
                if (now < expiresAt) {
                    result.push({
                        command: cooldown.commandName,
                        remaining: Math.ceil((expiresAt - now) / 1000)
                    });
                }
            }
        }
        
        return result;
    }

    maybeCleanupExpired() {
        const now = Date.now();
        
        if (now - this.lastCleanup < this.cleanupInterval) return;
        
        this.lastCleanup = now;
        let removedCount = 0;
        
        for (const [key, cooldown] of this.activeCooldowns.entries()) {
            const duration = this.getCooldownDuration(cooldown.commandName, cooldown.guildId);
            const expiresAt = cooldown.timestamp + (duration * 1000);
            
            if (now >= expiresAt) {
                this.activeCooldowns.delete(key);
                removedCount++;
            }
        }
        
        if (removedCount > 0) {
            logger.debug(`Cleaned up ${removedCount} expired cooldowns`);
        }
    }
    
    getActiveCooldownCount() {
        return this.activeCooldowns.size;
    }
    
    handleCooldown(message, commandName, sendNotification = true) {
        const userId = message.author.id;
        const guildId = message.guild ? message.guild.id : null;
        
        const remainingTime = this.checkCooldown(commandName, userId, guildId);
        
        if (remainingTime <= 0) {
            this.setCooldown(commandName, userId, guildId);
            return true;
        }
        
        if (sendNotification) {
            message.reply({
                content: `⏳ This command is on cooldown. Please wait ${remainingTime} second${remainingTime === 1 ? '' : 's'}.`
            }).catch(error => {
                logger.error(`Error sending cooldown message: ${error.message}`);
            });
        }
        
        return false;
    }
    
    handleInteractionCooldown(interaction, commandName) {
        const userId = interaction.user.id;
        const guildId = interaction.guild ? interaction.guild.id : null;
        
        const remainingTime = this.checkCooldown(commandName, userId, guildId);
        
        if (remainingTime <= 0) {
            this.setCooldown(commandName, userId, guildId);
            return true;
        }

        interaction.reply({
            content: `⏳ This command is on cooldown. Please wait ${remainingTime} second${remainingTime === 1 ? '' : 's'}.`,
            ephemeral: true
        }).catch(error => {
            logger.error(`Error sending cooldown message: ${error.message}`);
        });
        
        return false;
    }

    checkMemoryPressure() {
        const now = Date.now();

        if (now - this.lastMemoryCheck < this.memoryCheckInterval) return false;
        
        this.lastMemoryCheck = now;

        if (global.gc && process.memoryUsage) {
            global.gc();

            const memoryUsage = process.memoryUsage();
            const memoryRatio = memoryUsage.heapUsed / memoryUsage.heapTotal;
            
            if (memoryRatio > this.memoryPressureThreshold) {
                logger.warn(`Memory pressure detected (${(memoryRatio * 100).toFixed(1)}%), reducing cooldown tracking`);

                let removedCount = 0;
                const now = Date.now();
                
                for (const [key, cooldown] of this.activeCooldowns.entries()) {
                    const duration = this.getCooldownDuration(cooldown.commandName, cooldown.guildId);
                    const expiresAt = cooldown.timestamp + (duration * 1000);

                    if (now >= expiresAt || (now >= expiresAt - (duration * 100))) {
                        this.activeCooldowns.delete(key);
                        removedCount++;
                    }
                }
                
                logger.info(`Removed ${removedCount} cooldowns due to memory pressure`);
                return true;
            }
        }

        return false;
    }
}

module.exports = new CooldownManager();
