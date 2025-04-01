const logger = require('./logger');
const os = require('os');

class MemoryManager {
    constructor(client) {
        this.client = client;
        this.warningThreshold = 1.3 * 1024 * 1024 * 1024; // 1.3GB (65% of 2GB)
        this.criticalThreshold = 1.6 * 1024 * 1024 * 1024; // 1.6GB (80% of 2GB)
        this.lastCacheClear = Date.now();
        this.cacheInterval = 30 * 60 * 1000; 

        this.responseCache = new Map();

        this.startMonitoring();
    }
    
    startMonitoring() {
        setInterval(() => this.checkMemoryUsage(), 5 * 60 * 1000);
        logger.info('Memory monitoring started');
    }
    
    checkMemoryUsage() {
        const memoryUsage = process.memoryUsage();
        const systemFree = os.freemem();
        const systemTotal = os.totalmem();
        const systemUsedPercent = ((systemTotal - systemFree) / systemTotal) * 100;
        
        logger.info(`Memory status: ${Math.round(memoryUsage.heapUsed / 1024 / 1024)}MB heap, ${systemUsedPercent.toFixed(1)}% system RAM used`);

        if (systemFree < 400 * 1024 * 1024) { 
            logger.warn(`Low system memory: ${Math.round(systemFree / 1024 / 1024)}MB free`);
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
    }
    
    performMemoryCleanup(aggressive) {
        this.clearResponseCache();

        if (aggressive) {
            logger.warn('Performing aggressive memory cleanup');

            const activeGuildMembers = new Set();
            this.client.guilds.cache.forEach(guild => {
                if (guild.members?.cache) {
                    guild.members.cache.forEach(member => {
                        activeGuildMembers.add(member.id);
                    });
                }
            });
            
            // sweep users not in active guilds
            this.client.users.cache.sweep(user => !activeGuildMembers.has(user.id));
 
            if (global.gc) {
                logger.info('Triggering garbage collection');
                global.gc();
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
}

module.exports = MemoryManager;