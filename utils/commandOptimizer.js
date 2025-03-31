const deviceManager = require('./deviceManager');
const logger = require('./logger');

class CommandOptimizer {
    constructor(client) {
        this.client = client;
        this.commandStats = new Map();
        this.commandQueue = [];
        this.processingQueue = false;

        this.heavyCommands = new Set([
            'getvid',    
            'play',      
            'playlist',  
            'announce'   
        ]);

        setInterval(() => this.processQueue(), 100);
    }

    trackCommand(commandName, executionTime) {
        if (!this.commandStats.has(commandName)) {
            this.commandStats.set(commandName, {
                count: 0,
                totalTime: 0,
                avgTime: 0
            });
        }
        
        const stats = this.commandStats.get(commandName);
        stats.count++;
        stats.totalTime += executionTime;
        stats.avgTime = stats.totalTime / stats.count;
    }

    shouldQueueCommand(commandName) {
        if (this.heavyCommands.has(commandName) && deviceManager.shouldThrottle()) {
            return true;
        }

        const activeCommands = this.commandQueue.filter(cmd => cmd.running).length;
        if (activeCommands >= 3) {
            return true;
        }
        
        return false;
    }

    queueCommand(commandName, executeFunction) {
        return new Promise((resolve, reject) => {
            if (!this.shouldQueueCommand(commandName)) {
                this.executeWithTracking(commandName, executeFunction)
                    .then(resolve)
                    .catch(reject);
                return;
            }

            logger.info(`Queuing command: ${commandName}`);
            this.commandQueue.push({
                name: commandName,
                execute: executeFunction,
                resolve,
                reject,
                added: Date.now(),
                running: false
            });

            this.commandQueue.sort((a, b) => {
                if (this.heavyCommands.has(a.name) && !this.heavyCommands.has(b.name)) {
                    return 1;
                }
                if (!this.heavyCommands.has(a.name) && this.heavyCommands.has(b.name)) {
                    return -1;
                }
                return a.added - b.added;
            });
        });
    }

    async processQueue() {
        if (this.processingQueue || this.commandQueue.length === 0) {
            return;
        }
        
        this.processingQueue = true;
        
        try {
            const nextCommand = this.commandQueue.find(cmd => !cmd.running);
            
            if (nextCommand) {
                nextCommand.running = true;
                
                try {
                    const result = await this.executeWithTracking(
                        nextCommand.name, 
                        nextCommand.execute
                    );
                    nextCommand.resolve(result);
                } catch (error) {
                    nextCommand.reject(error);
                }

                this.commandQueue = this.commandQueue.filter(cmd => cmd !== nextCommand);
            }
        } catch (error) {
            logger.error('Error processing command queue:', error);
        } finally {
            this.processingQueue = false;
        }
    }

    async executeWithTracking(commandName, executeFunction) {
        const startTime = process.hrtime.bigint();
        
        try {
            return await executeFunction();
        } finally {
            const endTime = process.hrtime.bigint();
            const executionTime = Number(endTime - startTime) / 1_000_000; 
            
            this.trackCommand(commandName, executionTime);
            
            if (executionTime > 1000) {
                logger.warn(`Slow command execution: ${commandName} took ${executionTime.toFixed(2)}ms`);
            }
        }
    }

    getCommandStats() {
        const result = [];
        
        for (const [name, stats] of this.commandStats.entries()) {
            result.push({
                name,
                count: stats.count,
                avgTime: stats.avgTime.toFixed(2) + 'ms'
            });
        }
        
        return result.sort((a, b) => b.count - a.count);
    }
}

module.exports = CommandOptimizer;