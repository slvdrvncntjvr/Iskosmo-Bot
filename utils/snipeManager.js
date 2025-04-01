const fs = require('fs');
const path = require('path');
const logger = require('./logger');

class SnipeManager {
    constructor() {
        this.configPath = path.join(__dirname, '../data/snipeConfig.json');
        this.config = {
            allowedRoles: {} 
        };
        this.loadConfig();
    }

    loadConfig() {
        try {
            if (fs.existsSync(this.configPath)) {
                const data = fs.readFileSync(this.configPath, 'utf8');
                this.config = JSON.parse(data);

                if (!this.config.allowedRoles) {
                    this.config.allowedRoles = {};
                }
                
                logger.info(`Loaded snipe configuration for ${Object.keys(this.config.allowedRoles).length} guilds`);
            } else {
                this.config = {
                    allowedRoles: {}
                };
                this.saveConfig();
                logger.info('Created default snipe configuration');
            }
        } catch (error) {
            logger.error('Error loading snipe configuration:', error);
            this.config = { allowedRoles: {} };
        }
    }

    saveConfig() {
        try {
            fs.writeFileSync(this.configPath, JSON.stringify(this.config, null, 2), 'utf8');
            return true;
        } catch (error) {
            logger.error('Error saving snipe configuration:', error);
            return false;
        }
    }

    /**
     * Add a role to the allowed list for cross-channel sniping
     * @param {string} guildId - The guild ID
     * @param {string} roleId - The role ID to add
     * @returns {boolean} Success
     */
    addAllowedRole(guildId, roleId) {
        if (!this.config.allowedRoles[guildId]) {
            this.config.allowedRoles[guildId] = [];
        }
        
        if (!this.config.allowedRoles[guildId].includes(roleId)) {
            this.config.allowedRoles[guildId].push(roleId);
            this.saveConfig();
            return true;
        }
        
        return false;
    }

    /**
     * Remove a role from the allowed list for cross-channel sniping
     * @param {string} guildId - The guild ID
     * @param {string} roleId - The role ID to remove
     * @returns {boolean} Success
     */
    removeAllowedRole(guildId, roleId) {
        if (!this.config.allowedRoles[guildId]) {
            return false;
        }
        
        const initialLength = this.config.allowedRoles[guildId].length;
        this.config.allowedRoles[guildId] = this.config.allowedRoles[guildId].filter(id => id !== roleId);
        
        if (this.config.allowedRoles[guildId].length < initialLength) {
            this.saveConfig();
            return true;
        }
        
        return false;
    }

    /**
     * Get all allowed roles for a guild
     * @param {string} guildId - The guild ID
     * @returns {Array} Array of role IDs
     */
    getAllowedRoles(guildId) {
        return this.config.allowedRoles[guildId] || [];
    }

    /**
     * Check if a user has permission for cross-channel sniping
     * @param {Object} member - The Discord.js GuildMember object
     * @param {boolean} isOwner - Whether the user is the bot owner
     * @returns {boolean} Whether the user has permission
     */
    canSnipeAcrossChannels(member, isOwner) {
        if (isOwner) return true;

        if (member.permissions.has('ADMINISTRATOR')) return true;

        const guildId = member.guild.id;
        const allowedRoles = this.getAllowedRoles(guildId);
        
        if (allowedRoles.length === 0) {
            return false;
        }

        return member.roles.cache.some(role => allowedRoles.includes(role.id));
    }
}

module.exports = new SnipeManager();