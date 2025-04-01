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
    }
};

function loadPermissions() {
    try {
        if (fs.existsSync(PERMISSIONS_FILE)) {
            const data = JSON.parse(fs.readFileSync(PERMISSIONS_FILE, 'utf8'));
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


function savePermissions() {
    try {
        fs.writeFileSync(PERMISSIONS_FILE, JSON.stringify(permissionsData, null, 2), 'utf8');
        logger.info('Permissions data saved successfully');
    } catch (error) {
        logger.error('Error saving permissions data:', error);
    }
}

function isOwner(userId) {
    return permissionsData.owners.includes(userId);
}

function isAuthorized(userId, commandName) {
    console.log(`Checking auth for user ${userId} on command ${commandName}`);
    console.log(`Owner check: ${isOwner(userId)}`);
    console.log(`Command auth: ${permissionsData.commands[commandName]?.includes(userId)}`);
    
    if (isOwner(userId)) return true;
    
    if (permissionsData.commands[commandName] && 
        permissionsData.commands[commandName].includes(userId)) {
        return true;
    }
    
    return false;
}

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
    isAuthorized,
    addAuthorizedUser,
    removeAuthorizedUser,
    addOwner,
    removeOwner,
    getAuthorizedUsers,
    getOwners
};