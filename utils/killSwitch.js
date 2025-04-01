const fs = require('fs');
const path = require('path');
const logger = require('./logger');
const { ActivityType } = require('discord.js');
const cooldownManager = require('./cooldownManager');

const KILL_SWITCH_FILE = path.join(__dirname, '../data/killswitch.json');

class KillSwitch {
    constructor() {
        this.killed = false;
        this.killTime = null;
        this.client = null;
        this.previousStatus = null;
        this.initialized = false;
        this.loadState();
    }
    
    initialize(client) {
        this.client = client;
        logger.info('Kill switch initialized');
    }

    applyInitialState() {
        if (this.client && this.client.user) {
            if (this.killed) {
                this.applyKilledStatus();
                logger.warn('Applied killed status on startup');
            }
            this.initialized = true;
        } else {
            logger.error('Cannot apply kill switch state - client not ready');
        }
    }
    
    loadState() {
        try {
            if (fs.existsSync(KILL_SWITCH_FILE)) {
                const data = JSON.parse(fs.readFileSync(KILL_SWITCH_FILE, 'utf8'));
                this.killed = data.killed || false;
                this.killTime = data.killTime || null;
                
                if (this.killed) {
                    logger.warn(`Bot started in suspended state (killed at ${new Date(this.killTime).toISOString()})`);
                }
            }
        } catch (error) {
            logger.error('Error loading kill switch state:', error);
            this.killed = false;
            this.killTime = null;
        }
    }
    
    saveState() {
        try {
            fs.writeFileSync(KILL_SWITCH_FILE, JSON.stringify({
                killed: this.killed,
                killTime: this.killTime
            }), 'utf8');
        } catch (error) {
            logger.error('Error saving kill switch state:', error);
        }
    }
    
    isKilled() {
        return this.killed;
    }
    
    kill() {
        if (!this.client || !this.client.user) {
            logger.error('Kill switch not properly initialized with client');
            return false;
        }
        
        this.killed = true;
        this.killTime = Date.now();

        try {
            this.previousStatus = {
                activities: this.client.user.presence?.activities || [],
                status: this.client.user.presence?.status || 'online'
            };

            this.applyKilledStatus();
        } catch (error) {
            logger.error('Error setting presence during kill:', error);
        }

        if (cooldownManager) {
            const count = cooldownManager.resetAllCooldowns();
            logger.info(`Kill switch reset ${count} active cooldowns`);
        }
        
        this.saveState();
        logger.warn('Kill switch activated - bot appears offline');
        return true;
    }
    
    revive() {
        if (!this.client || !this.client.user) {
            logger.error('Kill switch not properly initialized with client');
            return false;
        }
        
        const wasKilled = this.killed;
        this.killed = false;
        
        try {
            if (this.previousStatus) {
                this.client.user.setPresence({
                    activities: this.previousStatus.activities,
                    status: this.previousStatus.status
                });
            } else if (this.client.statusManager) {
                this.client.statusManager.setDefaultStatus();
            } else {
                this.client.user.setPresence({
                    activities: [{
                        name: `in ${this.client.guilds.cache.size} guilds`,
                        type: ActivityType.Playing
                    }],
                    status: 'online'
                });
            }
        } catch (error) {
            logger.error('Error setting presence during revive:', error);
        }
        
        this.killTime = null;
        this.saveState();
        logger.info('Kill switch deactivated - bot is visible again');
        return wasKilled;
    }
    
    applyKilledStatus() {
        if (!this.client || !this.client.user) {
            logger.error('Cannot apply killed status - client not fully initialized');
            return;
        }
        
        try {
            this.client.user.setPresence({
                activities: [],
                status: 'invisible'
            });
        } catch (error) {
            logger.error('Error setting invisible status:', error);
        }
    }
    
    getDowntime() {
        if (!this.killed || !this.killTime) return 0;
        return Math.round((Date.now() - this.killTime) / 1000);
    }
}

module.exports = new KillSwitch();