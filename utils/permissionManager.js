const fs = require('fs');
const path = require('path');
const logger = require('./logger');

const PERMISSIONS_FILE = path.join(__dirname, '../data/permissions.json');

if (!fs.existsSync(path.join(__dirname, '../data'))) {
    fs.mkdirSync(path.join(__dirname, '../data'), { recursive: true });
}
let permissionsData = {
    owners: process.env.BOT_OWNER_ID ? [process.env.BOT_OWNER_ID] : [],
    commands: {
        // example: announce: ["123456789", "987654321"]
    },
    // New section for role-based permissions
    commandRoles: {
        // Format: "commandName": { "guildId": ["roleId1", "roleId2"] }
    },
    // New section for command categories (moderation, utility, etc)
    categoryRoles: {
        // Format: "category": { "guildId": ["roleId1", "roleId2"] }
    },
    // Bot operators are like sub-owners who can manage permissions but not sensitive commands
    operators: []
};

function loadPermissions() {
    try {
        if (fs.existsSync(PERMISSIONS_FILE)) {
            const data = JSON.parse(fs.readFileSync(PERMISSIONS_FILE, 'utf8'));
            
            // Add new fields if they don't exist (for backward compatibility)
            if (!data.commandRoles) data.commandRoles = {};
            if (!data.categoryRoles) data.categoryRoles = {};
            if (!data.operators) data.operators = [];
            
            permissionsData = data;
            logger.info('Permissions data loaded successfully');
        } else {
            savePermissions();
            logger.info('Created default permissions file');
        }
    } catch (error) {
        logger.error('Error loading permissions data:', error);
    }
}

// Save permissions to disk
function savePermissions() {
    try {
        fs.writeFileSync(PERMISSIONS_FILE, JSON.stringify(permissionsData, null, 2), 'utf8');
        logger.info('Permissions data saved successfully');
        return true;
    } catch (error) {
        logger.error('Error saving permissions data:', error);
        return false;
    }
}

// Helper function to get permission data (safer than accessing directly)
function getCommandRoleRequirements(commandName, guildId = null) {
    if (!commandName) return null;
    
    if (guildId) {
        return permissionsData.commandRoles[commandName]?.[guildId] || null;
    }
    
    return permissionsData.commandRoles[commandName] || null;
}

function getCategoryRoleRequirements(category, guildId = null) {
    if (!category) return null;
    
    if (guildId) {
        return permissionsData.categoryRoles[category]?.[guildId] || null;
    }
    
    return permissionsData.categoryRoles[category] || null;
}

function hasCommandRoleRequirements(commandName, guildId) {
    return !!permissionsData.commandRoles[commandName]?.[guildId]?.length;
}

function hasCategoryRoleRequirements(category, guildId) {
    return !!permissionsData.categoryRoles[category]?.[guildId]?.length;
}

// Check if user is a bot owner
function isOwner(userId) {
    return permissionsData.owners.includes(userId);
}

// Check if user is a bot operator
function isOperator(userId) {
    return isOwner(userId) || permissionsData.operators.includes(userId);
}

// Comprehensive authorization check
function isAuthorized(userId, commandName, guildId, memberRoles = []) {
    // Always allow owners
    if (isOwner(userId)) return true;
    
    // Check user-specific permission
    if (permissionsData.commands[commandName] && 
        permissionsData.commands[commandName].includes(userId)) {
        return true;
    }
    
    // If in a guild and we have member roles, check role-based permissions
    if (guildId && memberRoles.length > 0) {
        // Check command-specific roles
        if (permissionsData.commandRoles[commandName] && 
            permissionsData.commandRoles[commandName][guildId]) {
            const roleIds = permissionsData.commandRoles[commandName][guildId];
            if (memberRoles.some(role => roleIds.includes(role))) {
                return true;
            }
        }
        
        // Check category-based roles (if command has a category)
        const commandCategory = getCommandCategory(commandName);
        if (commandCategory && 
            permissionsData.categoryRoles[commandCategory] && 
            permissionsData.categoryRoles[commandCategory][guildId]) {
            const roleIds = permissionsData.categoryRoles[commandCategory][guildId];
            if (memberRoles.some(role => roleIds.includes(role))) {
                return true;
            }
        }
    }
    
    return false;
}

// Helper to get a command's category
function getCommandCategory(commandName) {
    try {
        // First try to find the command in the client's commands collection
        const commandsPath = path.join(__dirname, '../commands');
        const categories = fs.readdirSync(commandsPath).filter(dir => 
            fs.statSync(path.join(commandsPath, dir)).isDirectory()
        );
        
        // Check each category directory
        for (const category of categories) {
            const categoryPath = path.join(commandsPath, category);
            const commandFiles = fs.readdirSync(categoryPath).filter(file => 
                file.endsWith('.js')
            );
            
            // Check if this command exists in this category
            if (commandFiles.includes(`${commandName}.js`)) {
                return category;
            }
        }
        
        // If not found in the filesystem, try loading the command to check its category property
        try {
            const possiblePaths = categories.map(category => 
                path.join(commandsPath, category, `${commandName}.js`)
            );
            
            for (const cmdPath of possiblePaths) {
                if (fs.existsSync(cmdPath)) {
                    const command = require(cmdPath);
                    if (command.category) {
                        return command.category;
                    }
                }
            }
        } catch (e) {
            logger.warn(`Error getting category from command module: ${e.message}`);
        }
    } catch (error) {
        logger.error('Error determining command category:', error);
    }
    
    // If all else fails, return null
    return null;
}

// Add role for a specific command in a guild
function addCommandRole(commandName, guildId, roleId) {
    if (!permissionsData.commandRoles[commandName]) {
        permissionsData.commandRoles[commandName] = {};
    }
    
    if (!permissionsData.commandRoles[commandName][guildId]) {
        permissionsData.commandRoles[commandName][guildId] = [];
    }
    
    if (!permissionsData.commandRoles[commandName][guildId].includes(roleId)) {
        permissionsData.commandRoles[commandName][guildId].push(roleId);
        return savePermissions();
    }
    
    return false;
}

// Remove role from a specific command in a guild
function removeCommandRole(commandName, guildId, roleId) {
    if (!permissionsData.commandRoles[commandName] || 
        !permissionsData.commandRoles[commandName][guildId]) {
        return false;
    }
    
    const index = permissionsData.commandRoles[commandName][guildId].indexOf(roleId);
    if (index !== -1) {
        permissionsData.commandRoles[commandName][guildId].splice(index, 1);
        
        // Clean up empty entries
        if (permissionsData.commandRoles[commandName][guildId].length === 0) {
            delete permissionsData.commandRoles[commandName][guildId];
            
            if (Object.keys(permissionsData.commandRoles[commandName]).length === 0) {
                delete permissionsData.commandRoles[commandName];
            }
        }
        
        return savePermissions();
    }
    
    return false;
}

// Add role for a command category in a guild
function addCategoryRole(category, guildId, roleId) {
    if (!permissionsData.categoryRoles[category]) {
        permissionsData.categoryRoles[category] = {};
    }
    
    if (!permissionsData.categoryRoles[category][guildId]) {
        permissionsData.categoryRoles[category][guildId] = [];
    }
    
    if (!permissionsData.categoryRoles[category][guildId].includes(roleId)) {
        permissionsData.categoryRoles[category][guildId].push(roleId);
        return savePermissions();
    }
    
    return false;
}

// Remove role from a command category in a guild
function removeCategoryRole(category, guildId, roleId) {
    if (!permissionsData.categoryRoles[category] || 
        !permissionsData.categoryRoles[category][guildId]) {
        return false;
    }
    
    const index = permissionsData.categoryRoles[category][guildId].indexOf(roleId);
    if (index !== -1) {
        permissionsData.categoryRoles[category][guildId].splice(index, 1);
        
        // Clean up empty entries
        if (permissionsData.categoryRoles[category][guildId].length === 0) {
            delete permissionsData.categoryRoles[category][guildId];
            
            if (Object.keys(permissionsData.categoryRoles[category]).length === 0) {
                delete permissionsData.categoryRoles[category];
            }
        }
        
        return savePermissions();
    }
    
    return false;
}

// Get roles required for a command in a guild
function getCommandRoles(commandName, guildId) {
    if (permissionsData.commandRoles[commandName] && 
        permissionsData.commandRoles[commandName][guildId]) {
        return permissionsData.commandRoles[commandName][guildId];
    }
    return [];
}

// Get roles required for a category in a guild
function getCategoryRoles(category, guildId) {
    if (permissionsData.categoryRoles[category] && 
        permissionsData.categoryRoles[category][guildId]) {
        return permissionsData.categoryRoles[category][guildId];
    }
    return [];
}

// Add a bot operator (sub-owner)
function addOperator(userId) {
    if (!permissionsData.operators.includes(userId)) {
        permissionsData.operators.push(userId);
        return savePermissions();
    }
    return false;
}

// Remove a bot operator
function removeOperator(userId) {
    const index = permissionsData.operators.indexOf(userId);
    if (index !== -1) {
        permissionsData.operators.splice(index, 1);
        return savePermissions();
    }
    return false;
}

// Get all bot operators
function getOperators() {
    return permissionsData.operators;
}

// Existing functions
function addAuthorizedUser(commandName, userId) {
    if (!permissionsData.commands[commandName]) {
        permissionsData.commands[commandName] = [];
    }
    
    if (!permissionsData.commands[commandName].includes(userId)) {
        permissionsData.commands[commandName].push(userId);
        savePermissions();
        return true;
    }
    
    return false;
}

function removeAuthorizedUser(commandName, userId) {
    if (!permissionsData.commands[commandName]) {
        return false;
    }
    
    const index = permissionsData.commands[commandName].indexOf(userId);
    if (index !== -1) {
        permissionsData.commands[commandName].splice(index, 1);
        savePermissions();
        return true;
    }
    
    return false;
}

function addOwner(userId) {
    if (!permissionsData.owners.includes(userId)) {
        permissionsData.owners.push(userId);
        savePermissions();
        return true;
    }
    
    return false;
}

function removeOwner(userId) {
    const index = permissionsData.owners.indexOf(userId);
    if (index !== -1) {
        permissionsData.owners.splice(index, 1);
        savePermissions();
        return true;
    }
    
    return false;
}

function getAuthorizedUsers(commandName) {
    return permissionsData.commands[commandName] || [];
}

function getOwners() {
    return permissionsData.owners;
}

loadPermissions();

module.exports = {
    isOwner,
    isOperator,
    isAuthorized,
    addAuthorizedUser,
    removeAuthorizedUser,
    addOwner,
    removeOwner,
    getAuthorizedUsers,
    getOwners,
    // New exports
    addCommandRole,
    removeCommandRole,
    addCategoryRole,
    removeCategoryRole,
    getCommandRoles,
    getCategoryRoles,
    addOperator,
    removeOperator,
    getOperators,
    // Helper functions
    getCommandCategory,
    hasCommandRoleRequirements,
    hasCategoryRoleRequirements
};