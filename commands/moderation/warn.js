const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const { createEmbed } = require('../../utils/embedBuilder');
const logger = require('../../utils/logger');
const fs = require('fs');
const path = require('path');

const warningsFilePath = path.join(__dirname, '../../data/warnings.json');

// Helper functions for managing warnings
const getWarnings = () => {
    try {
        if (!fs.existsSync(warningsFilePath)) {
            fs.writeFileSync(warningsFilePath, JSON.stringify({}), 'utf8');
            return {};
        }
        
        const fileContent = fs.readFileSync(warningsFilePath, 'utf8');
        
        // Check if file is empty or just whitespace
        if (!fileContent.trim()) {
            logger.warn('Warnings file is empty, creating new warnings object');
            fs.writeFileSync(warningsFilePath, JSON.stringify({}), 'utf8');
            return {};
        }
        
        try {
            return JSON.parse(fileContent);
        } catch (parseError) {
            logger.error('Error parsing warnings file, creating backup and resetting:', parseError);
            // Create backup of corrupted file
            const backupPath = `${warningsFilePath}.${Date.now()}.backup`;
            fs.writeFileSync(backupPath, fileContent, 'utf8');
            logger.info(`Created backup of corrupted warnings file at ${backupPath}`);
            
            // Reset warnings
            fs.writeFileSync(warningsFilePath, JSON.stringify({}), 'utf8');
            return {};
        }
    } catch (error) {
        logger.error('Error loading warnings:', error);
        return {};
    }
};

const saveWarnings = (warnings) => {
    try {
        // First write to a temporary file
        const tempFilePath = `${warningsFilePath}.temp`;
        fs.writeFileSync(tempFilePath, JSON.stringify(warnings, null, 2), 'utf8');
        
        // Verify that the temp file is valid JSON
        try {
            const testRead = fs.readFileSync(tempFilePath, 'utf8');
            JSON.parse(testRead); // Will throw if invalid
            
            // If we get here, the file is valid - rename to replace the original
            if (fs.existsSync(warningsFilePath)) {
                fs.unlinkSync(warningsFilePath); // Delete original
            }
            fs.renameSync(tempFilePath, warningsFilePath);
            return true;
        } catch (verifyError) {
            logger.error('Failed to verify temporary warnings file:', verifyError);
            if (fs.existsSync(tempFilePath)) {
                fs.unlinkSync(tempFilePath); // Clean up temp file
            }
            return false;
        }
    } catch (error) {
        logger.error('Error saving warnings:', error);
        return false;
    }
};

const addWarning = (guildId, userId, moderatorId, reason) => {
    const warnings = getWarnings();
    
    if (!warnings[guildId]) {
        warnings[guildId] = {};
    }
    
    if (!warnings[guildId][userId]) {
        warnings[guildId][userId] = [];
    }
    
    const warning = {
        id: Date.now().toString(36) + Math.random().toString(36).substr(2, 5),
        timestamp: Date.now(),
        moderatorId,
        reason
    };
    
    warnings[guildId][userId].push(warning);
    
    return saveWarnings(warnings) ? warning : null;
};

const removeWarning = (guildId, userId, warningId) => {
    const warnings = getWarnings();
    
    if (!warnings[guildId] || !warnings[guildId][userId]) {
        return false;
    }
    
    const initialLength = warnings[guildId][userId].length;
    warnings[guildId][userId] = warnings[guildId][userId].filter(w => w.id !== warningId);
    
    if (warnings[guildId][userId].length === initialLength) {
        return false;  // No warning was removed
    }
    
    // Cleanup empty entries
    if (warnings[guildId][userId].length === 0) {
        delete warnings[guildId][userId];
        
        if (Object.keys(warnings[guildId]).length === 0) {
            delete warnings[guildId];
        }
    }
    
    return saveWarnings(warnings);
};

const clearWarnings = (guildId, userId) => {
    const warnings = getWarnings();
    
    if (!warnings[guildId] || !warnings[guildId][userId]) {
        return false;
    }
    
    const count = warnings[guildId][userId].length;
    delete warnings[guildId][userId];
    
    if (Object.keys(warnings[guildId]).length === 0) {
        delete warnings[guildId];
    }
    
    return saveWarnings(warnings) ? count : 0;
};

const getUserWarnings = (guildId, userId) => {
    const warnings = getWarnings();
    return (warnings[guildId] && warnings[guildId][userId]) ? warnings[guildId][userId] : [];
};

module.exports = {
    name: 'warn',
    description: 'Manage warnings for users',
    usage: '<add/remove/clear/list> <user> [reason/warning ID]',
    category: 'moderation',
    guildOnly: true,
    permissions: [PermissionFlagsBits.ModerateMembers],
    
    slashCommand: new SlashCommandBuilder()
        .setName('warn')
        .setDescription('Manage warnings for users')
        .addSubcommand(subcommand => 
            subcommand
                .setName('add')
                .setDescription('Add a warning to a user')
                .addUserOption(option => 
                    option.setName('user')
                        .setDescription('The user to warn')
                        .setRequired(true))
                .addStringOption(option => 
                    option.setName('reason')
                        .setDescription('Reason for the warning')
                        .setRequired(true)))
        .addSubcommand(subcommand => 
            subcommand
                .setName('remove')
                .setDescription('Remove a warning from a user')
                .addUserOption(option => 
                    option.setName('user')
                        .setDescription('The user whose warning to remove')
                        .setRequired(true))
                .addStringOption(option => 
                    option.setName('id')
                        .setDescription('ID of the warning to remove')
                        .setRequired(true)))
        .addSubcommand(subcommand => 
            subcommand
                .setName('clear')
                .setDescription('Clear all warnings for a user')
                .addUserOption(option => 
                    option.setName('user')
                        .setDescription('The user whose warnings to clear')
                        .setRequired(true)))
        .addSubcommand(subcommand => 
            subcommand
                .setName('list')
                .setDescription('List warnings for a user')
                .addUserOption(option => 
                    option.setName('user')
                        .setDescription('The user to check warnings for')
                        .setRequired(true)))
        .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers),
    
    async execute(message, args, client) {
        // Fix for undefined prefix error
        if (!client.config) {
            client.config = { prefix: '!' }; // Default prefix if config is undefined
        }
        
        if (!args.length) {
            return message.reply({ 
                embeds: [createEmbed({
                    title: 'Command Error',
                    description: `Usage: ${client.config.prefix}${this.name} ${this.usage}`,
                    type: 'error'
                })]
            });
        }
        
        const subcommand = args[0].toLowerCase();
        const guildId = message.guild.id;
        
        if (subcommand === 'add') {
            const target = message.mentions.users.first();
            
            if (!target) {
                return message.reply({ 
                    embeds: [createEmbed({
                        title: 'Command Error',
                        description: 'You need to mention a user to warn.',
                        type: 'error'
                    })]
                });
            }
            
            // Make sure you can't warn yourself or the bot
            if (target.id === message.author.id) {
                return message.reply({ 
                    embeds: [createEmbed({
                        title: 'Command Error',
                        description: 'You cannot warn yourself.',
                        type: 'error'
                    })]
                });
            }
            
            if (target.id === client.user.id) {
                return message.reply({ 
                    embeds: [createEmbed({
                        title: 'Command Error',
                        description: 'I cannot warn myself.',
                        type: 'error'
                    })]
                });
            }
            
            // FIX: Improved check for moderator permissions
            const targetMember = await message.guild.members.fetch(target.id).catch(() => null);
            if (targetMember && targetMember.permissions.has(PermissionFlagsBits.ModerateMembers) && 
                !message.member.permissions.has(PermissionFlagsBits.Administrator)) {
                // Only block if target is a mod AND warner is not an admin
                return message.reply({ 
                    embeds: [createEmbed({
                        title: 'Command Error',
                        description: 'You cannot warn a moderator unless you are an administrator.',
                        type: 'error'
                    })]
                });
            }
            
            const reason = args.slice(2).join(' ') || 'No reason provided';
            
            const warning = addWarning(guildId, target.id, message.author.id, reason);
            
            if (!warning) {
                return message.reply({ 
                    embeds: [createEmbed({
                        title: 'Command Error',
                        description: 'Failed to add warning. Please try again.',
                        type: 'error'
                    })]
                });
            }
            
            // Get number of warnings
            const userWarnings = getUserWarnings(guildId, target.id);
            
            // Send confirmation
            message.reply({ 
                embeds: [createEmbed({
                    title: 'User Warned',
                    description: `${target.tag} has been warned.`,
                    type: 'success',
                    fields: [
                        { name: 'User', value: `${target.tag} (${target.id})` },
                        { name: 'Moderator', value: message.author.tag },
                        { name: 'Reason', value: reason },
                        { name: 'Warning ID', value: warning.id },
                        { name: 'Total Warnings', value: userWarnings.length.toString() }
                    ]
                })]
            });
            
            // DM the user about the warning
            try {
                await target.send({ 
                    embeds: [createEmbed({
                        title: `You've Been Warned in ${message.guild.name}`,
                        description: `You have received a warning in ${message.guild.name}.`,
                        type: 'warning',
                        fields: [
                            { name: 'Reason', value: reason },
                            { name: 'Warned By', value: message.author.tag },
                            { name: 'Total Warnings', value: userWarnings.length.toString() }
                        ]
                    })]
                });
            } catch (dmError) {
                logger.warn(`Couldn't send warning DM to ${target.tag}`);
            }
            
            logger.info(`${message.author.tag} warned ${target.tag} for: ${reason}`);
            logger.logToDiscord(client, `${message.author.tag} warned ${target.tag} for: ${reason} in ${message.guild.name}`);
        }
        
        else if (subcommand === 'remove') {
            const target = message.mentions.users.first();
            
            if (!target) {
                return message.reply({ 
                    embeds: [createEmbed({
                        title: 'Command Error',
                        description: 'You need to mention a user.',
                        type: 'error'
                    })]
                });
            }
            
            const warningId = args[2];
            
            if (!warningId) {
                return message.reply({ 
                    embeds: [createEmbed({
                        title: 'Command Error',
                        description: 'You need to specify a warning ID to remove.',
                        type: 'error'
                    })]
                });
            }
            
            const removed = removeWarning(guildId, target.id, warningId);
            
            if (!removed) {
                return message.reply({ 
                    embeds: [createEmbed({
                        title: 'Command Error',
                        description: `Warning with ID ${warningId} not found for ${target.tag}.`,
                        type: 'error'
                    })]
                });
            }
            
            // Get updated number of warnings
            const userWarnings = getUserWarnings(guildId, target.id);
            
            message.reply({ 
                embeds: [createEmbed({
                    title: 'Warning Removed',
                    description: `Warning has been removed from ${target.tag}.`,
                    type: 'success',
                    fields: [
                        { name: 'User', value: `${target.tag} (${target.id})` },
                        { name: 'Moderator', value: message.author.tag },
                        { name: 'Warning ID', value: warningId },
                        { name: 'Remaining Warnings', value: userWarnings.length.toString() }
                    ]
                })]
            });
            
            logger.info(`${message.author.tag} removed warning ${warningId} from ${target.tag}`);
            logger.logToDiscord(client, `${message.author.tag} removed warning ${warningId} from ${target.tag} in ${message.guild.name}`);
        }
        
        else if (subcommand === 'clear') {
            const target = message.mentions.users.first();
            
            if (!target) {
                return message.reply({ 
                    embeds: [createEmbed({
                        title: 'Command Error',
                        description: 'You need to mention a user.',
                        type: 'error'
                    })]
                });
            }
            
            const count = clearWarnings(guildId, target.id);
            
            if (!count) {
                return message.reply({ 
                    embeds: [createEmbed({
                        title: 'No Warnings',
                        description: `${target.tag} doesn't have any warnings.`,
                        type: 'info'
                    })]
                });
            }
            
            message.reply({ 
                embeds: [createEmbed({
                    title: 'Warnings Cleared',
                    description: `All warnings have been cleared for ${target.tag}.`,
                    type: 'success',
                    fields: [
                        { name: 'User', value: `${target.tag} (${target.id})` },
                        { name: 'Moderator', value: message.author.tag },
                        { name: 'Warnings Cleared', value: count.toString() }
                    ]
                })]
            });
            
            logger.info(`${message.author.tag} cleared all warnings for ${target.tag}`);
            logger.logToDiscord(client, `${message.author.tag} cleared all warnings (${count}) for ${target.tag} in ${message.guild.name}`);
        }
        
        else if (subcommand === 'list') {
            const target = message.mentions.users.first();
            
            if (!target) {
                return message.reply({ 
                    embeds: [createEmbed({
                        title: 'Command Error',
                        description: 'You need to mention a user.',
                        type: 'error'
                    })]
                });
            }
            
            const warnings = getUserWarnings(guildId, target.id);
            
            if (warnings.length === 0) {
                return message.reply({ 
                    embeds: [createEmbed({
                        title: 'No Warnings',
                        description: `${target.tag} doesn't have any warnings.`,
                        type: 'info'
                    })]
                });
            }
            
            // Format warnings
            const warningsList = warnings.map((warning, index) => {
                const date = new Date(warning.timestamp).toLocaleString();
                const moderator = client.users.cache.get(warning.moderatorId)?.tag || 'Unknown Moderator';
                
                return `**${index + 1}.** ID: \`${warning.id}\`
                Date: ${date}
                Moderator: ${moderator}
                Reason: ${warning.reason}`;
            }).join('\n\n');
            
            message.reply({ 
                embeds: [createEmbed({
                    title: `Warnings for ${target.tag}`,
                    description: `${target.tag} has ${warnings.length} warning(s):`,
                    type: 'info',
                    fields: [
                        { name: 'Warning History', value: warningsList }
                    ]
                })]
            });
            
            logger.info(`${message.author.tag} viewed warnings for ${target.tag}`);
        }
        
        else {
            message.reply({ 
                embeds: [createEmbed({
                    title: 'Command Error',
                    description: `Unknown subcommand "${subcommand}". Use add, remove, clear, or list.`,
                    type: 'error'
                })]
            });
        }
    },
    
    async executeSlash(interaction, client) {
        const subcommand = interaction.options.getSubcommand();
        const target = interaction.options.getUser('user');
        const guildId = interaction.guild.id;
        
        if (subcommand === 'add') {
            // Make sure you can't warn yourself or the bot
            if (target.id === interaction.user.id) {
                return interaction.reply({ 
                    embeds: [createEmbed({
                        title: 'Command Error',
                        description: 'You cannot warn yourself.',
                        type: 'error'
                    })],
                    ephemeral: true
                });
            }
            
            if (target.id === client.user.id) {
                return interaction.reply({ 
                    embeds: [createEmbed({
                        title: 'Command Error',
                        description: 'I cannot warn myself.',
                        type: 'error'
                    })],
                    ephemeral: true
                });
            }
            
            // Check if target is a moderator/admin
            const targetMember = await interaction.guild.members.fetch(target.id).catch(() => null);
            if (targetMember && targetMember.permissions.has(PermissionFlagsBits.ModerateMembers) && 
                !interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
                // Only block if target is a mod AND warner is not an admin
                return interaction.reply({ 
                    embeds: [createEmbed({
                        title: 'Command Error',
                        description: 'You cannot warn a moderator unless you are an administrator.',
                        type: 'error'
                    })],
                    ephemeral: true
                });
            }
            
            const reason = interaction.options.getString('reason');
            
            const warning = addWarning(guildId, target.id, interaction.user.id, reason);
            
            if (!warning) {
                return interaction.reply({ 
                    embeds: [createEmbed({
                        title: 'Command Error',
                        description: 'Failed to add warning. Please try again.',
                        type: 'error'
                    })],
                    ephemeral: true
                });
            }
            
            // Get number of warnings
            const userWarnings = getUserWarnings(guildId, target.id);
            
            // Send confirmation
            interaction.reply({ 
                embeds: [createEmbed({
                    title: 'User Warned',
                    description: `${target.tag} has been warned.`,
                    type: 'success',
                    fields: [
                        { name: 'User', value: `${target.tag} (${target.id})` },
                        { name: 'Moderator', value: interaction.user.tag },
                        { name: 'Reason', value: reason },
                        { name: 'Warning ID', value: warning.id },
                        { name: 'Total Warnings', value: userWarnings.length.toString() }
                    ]
                })]
            });
            
            // DM the user about the warning
            try {
                await target.send({ 
                    embeds: [createEmbed({
                        title: `You've Been Warned in ${interaction.guild.name}`,
                        description: `You have received a warning in ${interaction.guild.name}.`,
                        type: 'warning',
                        fields: [
                            { name: 'Reason', value: reason },
                            { name: 'Warned By', value: interaction.user.tag },
                            { name: 'Total Warnings', value: userWarnings.length.toString() }
                        ]
                    })]
                });
            } catch (dmError) {
                logger.warn(`Couldn't send warning DM to ${target.tag}`);
            }
            
            logger.info(`${interaction.user.tag} warned ${target.tag} for: ${reason}`);
            logger.logToDiscord(client, `${interaction.user.tag} warned ${target.tag} for: ${reason} in ${interaction.guild.name}`);
        }
        
        else if (subcommand === 'remove') {
            const warningId = interaction.options.getString('id');
            
            const removed = removeWarning(guildId, target.id, warningId);
            
            if (!removed) {
                return interaction.reply({ 
                    embeds: [createEmbed({
                        title: 'Command Error',
                        description: `Warning with ID ${warningId} not found for ${target.tag}.`,
                        type: 'error'
                    })],
                    ephemeral: true
                });
            }
            
            // Get updated number of warnings
            const userWarnings = getUserWarnings(guildId, target.id);
            
            interaction.reply({ 
                embeds: [createEmbed({
                    title: 'Warning Removed',
                    description: `Warning has been removed from ${target.tag}.`,
                    type: 'success',
                    fields: [
                        { name: 'User', value: `${target.tag} (${target.id})` },
                        { name: 'Moderator', value: interaction.user.tag },
                        { name: 'Warning ID', value: warningId },
                        { name: 'Remaining Warnings', value: userWarnings.length.toString() }
                    ]
                })]
            });
            
            logger.info(`${interaction.user.tag} removed warning ${warningId} from ${target.tag}`);
            logger.logToDiscord(client, `${interaction.user.tag} removed warning ${warningId} from ${target.tag} in ${interaction.guild.name}`);
        }
        
        else if (subcommand === 'clear') {
            const count = clearWarnings(guildId, target.id);
            
            if (!count) {
                return interaction.reply({ 
                    embeds: [createEmbed({
                        title: 'No Warnings',
                        description: `${target.tag} doesn't have any warnings.`,
                        type: 'info'
                    })]
                });
            }
            
            interaction.reply({ 
                embeds: [createEmbed({
                    title: 'Warnings Cleared',
                    description: `All warnings have been cleared for ${target.tag}.`,
                    type: 'success',
                    fields: [
                        { name: 'User', value: `${target.tag} (${target.id})` },
                        { name: 'Moderator', value: interaction.user.tag },
                        { name: 'Warnings Cleared', value: count.toString() }
                    ]
                })]
            });
            
            logger.info(`${interaction.user.tag} cleared all warnings for ${target.tag}`);
            logger.logToDiscord(client, `${interaction.user.tag} cleared all warnings (${count}) for ${target.tag} in ${interaction.guild.name}`);
        }
        
        else if (subcommand === 'list') {
            const warnings = getUserWarnings(guildId, target.id);
            
            if (warnings.length === 0) {
                return interaction.reply({ 
                    embeds: [createEmbed({
                        title: 'No Warnings',
                        description: `${target.tag} doesn't have any warnings.`,
                        type: 'info'
                    })]
                });
            }
            
            // Format warnings
            const warningsList = warnings.map((warning, index) => {
                const date = new Date(warning.timestamp).toLocaleString();
                const moderator = client.users.cache.get(warning.moderatorId)?.tag || 'Unknown Moderator';
                
                return `**${index + 1}.** ID: \`${warning.id}\`
                Date: ${date}
                Moderator: ${moderator}
                Reason: ${warning.reason}`;
            }).join('\n\n');
            
            interaction.reply({ 
                embeds: [createEmbed({
                    title: `Warnings for ${target.tag}`,
                    description: `${target.tag} has ${warnings.length} warning(s):`,
                    type: 'info',
                    fields: [
                        { name: 'Warning History', value: warningsList }
                    ]
                })]
            });
            
            logger.info(`${interaction.user.tag} viewed warnings for ${target.tag}`);
        }
    }
};