const logger = require('./logger');
const os = require('os');
const cooldownManager = require('./cooldownManager');
const messageTracker = require('./messageTracker');

class MemoryManager {
    constructor(client) {
        this.client = client;
        this.warningThreshold = 800 * 1024 * 1024;
        this.criticalThreshold = 1024 * 1024 * 1024;
        this.lowSystemMemoryThreshold = 400 * 1024 * 1024;
        this.heapUsagePercentWarning = 95;
        this.heapUsagePercentCritical = 98;
        this.lastCacheClear = Date.now();
        this.cacheInterval = 30 * 60 * 1000;
        this.memoryCheckInterval = 2 * 60 * 1000;
        this.minimumHeapSizeForPercentageCheck = 100 * 1024 * 1024;

        this.responseCache = new Map();
        
        this.inRecoveryMode = false;
        this.recoveryModeStarted = null;
        this.recoveryModeDuration = 5 * 60 * 1000;

        this.startMonitoring();
    }
    
    startMonitoring() {
        setInterval(() => this.checkMemoryUsage(), this.memoryCheckInterval);
        logger.info('Memory monitoring started with adjusted thresholds for low-memory device');
    }
    
    checkMemoryUsage() {
        const memoryUsage = process.memoryUsage();
        const systemFree = os.freemem();
        const systemTotal = os.totalmem();
        const systemUsedPercent = ((systemTotal - systemFree) / systemTotal) * 100;
        
        logger.info(`Memory status: ${Math.round(memoryUsage.heapUsed / 1024 / 1024)}MB heap, ${systemUsedPercent.toFixed(1)}% system RAM used, ${Math.round(systemFree / 1024 / 1024)}MB free`);

        if (this.inRecoveryMode) {
            const now = Date.now();
            if (now - this.recoveryModeStarted > this.recoveryModeDuration && 
                systemFree > this.lowSystemMemoryThreshold * 1.5 &&
                memoryUsage.heapUsed < this.warningThreshold * 0.8) {
                this.inRecoveryMode = false;
                logger.info('Exiting memory recovery mode - system memory has recovered');
            }
        }

        if (systemFree < this.lowSystemMemoryThreshold) { 
            logger.warn(`Low system memory: ${Math.round(systemFree / 1024 / 1024)}MB free - entering recovery mode`);
            this.enterRecoveryMode();
            this.performMemoryCleanup(true);
            return;
        }

        if (memoryUsage.heapUsed > this.warningThreshold) {
            logger.warn(`High memory usage: ${Math.round(memoryUsage.heapUsed / 1024 / 1024)}MB`);
            this.performMemoryCleanup(false);
        }

        if (Date.now() - this.lastCacheClear > this.cacheInterval) {
            logger.info('Performing routine cache cleanup');
            this.clearResponseCache();
            this.lastCacheClear = Date.now();
        }

        const heapUsedPercent = (memoryUsage.heapUsed / memoryUsage.heapTotal) * 100;
        if (memoryUsage.heapUsed > this.minimumHeapSizeForPercentageCheck) {
            if (heapUsedPercent > this.heapUsagePercentWarning) {
                logger.warn(`High heap usage: ${heapUsedPercent.toFixed(1)}%`);
                this.performMemoryCleanup(false);
            }

            if (heapUsedPercent > this.heapUsagePercentCritical) {
                logger.error(`Critical heap usage: ${heapUsedPercent.toFixed(1)}% - immediate action required!`);
                this.enterRecoveryMode();
                this.performMemoryCleanup(true);
            }
        } else {
            if (heapUsedPercent > this.heapUsagePercentWarning) {
                logger.info(`High heap percentage (${heapUsedPercent.toFixed(1)}%) but small absolute size (${Math.round(memoryUsage.heapUsed / 1024 / 1024)}MB) - no action needed`);
            }
        }
    }
    
    enterRecoveryMode() {
        if (!this.inRecoveryMode) {
            this.inRecoveryMode = true;
            this.recoveryModeStarted = Date.now();
            logger.warn('Entering memory recovery mode - limiting functionality to preserve stability');
            console.log('\x1b[41m\x1b[37m%s\x1b[0m', ' MEMORY RECOVERY MODE ACTIVE ');
        }
    }
    
    performMemoryCleanup(aggressive) {
        this.clearResponseCache();

        if (messageTracker) {
            messageTracker.cleanupOldMessages(aggressive);
        }

        if (cooldownManager) {
            cooldownManager.maybeCleanupExpired();
            if (aggressive) {
                const essentialCommands = ['getvid', 'announce', 'debug'];
                let removedCount = 0;
                
                for (const [key, cooldown] of [...cooldownManager.activeCooldowns.entries()]) {
                    if (!essentialCommands.includes(cooldown.commandName)) {
                        cooldownManager.activeCooldowns.delete(key);
                        removedCount++;
                    }
                }
                
                if (removedCount > 0) {
                    logger.warn(`Emergency cleanup: Removed ${removedCount} non-essential cooldowns`);
                }
            }
        }

        if (aggressive) {
            logger.warn('Performing aggressive memory cleanup');

            const activeGuildMembers = new Set();
            if (this.client && this.client.guilds) {
                this.client.guilds.cache.forEach(guild => {
                    if (guild.members?.cache) {
                        guild.members.cache.forEach(member => {
                            activeGuildMembers.add(member.id);
                        });
                    }
                });
            }
            
            if (this.client && this.client.users) {
                const initialSize = this.client.users.cache.size;
                this.client.users.cache.sweep(user => !activeGuildMembers.has(user.id));
                const removedUsers = initialSize - this.client.users.cache.size;
                if (removedUsers > 0) {
                    logger.info(`Memory cleanup: Removed ${removedUsers} cached users`);
                }
            }
 
            if (global.gc) {
                logger.info('Triggering garbage collection');
                try {
                    global.gc();
                } catch (error) {
                    logger.error('Error during forced garbage collection:', error);
                }
            }
        }
        
        logger.info('Memory cleanup completed');
    }
    
    clearResponseCache() {
        const cacheSize = this.responseCache.size;
        this.responseCache.clear();
        logger.info(`Cleared response cache (${cacheSize} items)`);
    }

    cacheResponse(commandName, key, response, ttl = 10 * 60 * 1000) { 
        if (this.inRecoveryMode) return;
        
        const cacheKey = `${commandName}:${key}`;
        this.responseCache.set(cacheKey, {
            data: response,
            expires: Date.now() + ttl
        });
    }

    getCachedResponse(commandName, key) {
        const cacheKey = `${commandName}:${key}`;
        const cached = this.responseCache.get(cacheKey);
        
        if (!cached) return null;
        if (cached.expires < Date.now()) {
            this.responseCache.delete(cacheKey);
            return null;
        }
        
        return cached.data;
    }
    
    isInRecoveryMode() {
        return this.inRecoveryMode;
    }
    
    getMemoryStatus() {
        const memoryUsage = process.memoryUsage();
        const systemFree = os.freemem();
        const systemTotal = os.totalmem();
        
        return {
            heapUsed: Math.round(memoryUsage.heapUsed / 1024 / 1024),
            heapTotal: Math.round(memoryUsage.heapTotal / 1024 / 1024),
            systemFree: Math.round(systemFree / 1024 / 1024),
            systemTotal: Math.round(systemTotal / 1024 / 1024),
            systemUsedPercent: ((systemTotal - systemFree) / systemTotal) * 100,
            inRecoveryMode: this.inRecoveryMode
        };
    }
}

module.exports = MemoryManager;
