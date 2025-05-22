const { SlashCommandBuilder } = require('discord.js');
const config = require('../../config');
const { createEmbed } = require('../../utils/embedBuilder');
const cooldownManager = require('../../utils/cooldownManager');
const permissionManager = require('../../utils/permissionManager');

module.exports = {
    name: 'help',
    description: 'Display available commands or info about a specific command',
    usage: '[command name]',
    category: 'utility',

    slashCommand: new SlashCommandBuilder()
        .setName('help')
        .setDescription('Display available commands or info about a specific command')
        .addStringOption(option => 
            option.setName('command')
                .setDescription('The specific command to get info about')
                .setRequired(false)),
    
    async execute(message, args, client) {
        const { commands } = client;
        const isOwner = permissionManager.isOwner(message.author.id);
        const isServerOwner = message.guild && message.author.id === message.guild.ownerId;
        const isAdmin = message.member && message.member.permissions.has('Administrator');
 
        if (!args.length) {
            const categories = {};
            commands.forEach(command => {
                // Filter commands based on permissions
                if (command.ownerOnly && !isOwner) {
                    return; // Skip owner-only commands
                }
                
                // Skip commands that require server owner if user isn't the owner
                if (command.serverOwnerOnly && !isServerOwner && !isOwner) {
                    return;
                }
                
                // Skip admin commands if user isn't an admin
                if (command.adminOnly && !isAdmin && !isServerOwner && !isOwner) {
                    return;
                }
                
                // Check role requirements
                if (message.guild && command.name && !this.hasRequiredRole(message, command.name)) {
                    return;
                }
                
                const category = command.category || 'Uncategorized';
                
                if (!categories[category]) {
                    categories[category] = [];
                }
                
                categories[category].push(command);
            });
            
            const helpEmbed = createEmbed({
                title: 'Command Help',
                description: `Use \`${config.prefix}help [command name]\` to get info on a specific command.`,
                type: 'info'
            });

            for (const [category, cmds] of Object.entries(categories)) {
                // Skip empty categories (might happen if all commands were hidden)
                if (cmds.length === 0) continue;
                
                helpEmbed.addFields({
                    name: `📁 ${category.charAt(0).toUpperCase() + category.slice(1)}`,
                    value: cmds.map(cmd => `\`${cmd.name}\`: ${cmd.description}`).join('\n')
                });
            }
            
            return message.reply({ embeds: [helpEmbed] });
        }
        
        const commandName = args[0].toLowerCase();
        const command = commands.get(commandName);
        
        if (!command) {
            return message.reply({ 
                embeds: [createEmbed({
                    title: 'Command Not Found',
                    description: `Could not find command \`${commandName}\`.`,
                    type: 'error'
                })]
            });
        }
        
        // Check if user has permission to see this command
        if ((command.ownerOnly && !isOwner) || 
            (command.serverOwnerOnly && !isServerOwner && !isOwner) ||
            (command.adminOnly && !isAdmin && !isServerOwner && !isOwner) ||
            (message.guild && !this.hasRequiredRole(message, command.name))) {
            return message.reply({ 
                embeds: [createEmbed({
                    title: 'Command Not Found',
                    description: `Could not find command \`${commandName}\`.`,
                    type: 'error'
                })]
            });
        }
        
        const commandEmbed = createEmbed({
            title: `Command: ${command.name}`,
            description: command.description,
            type: 'info'
        });
        
        if (command.aliases) {
            commandEmbed.addFields({ name: 'Aliases', value: command.aliases.join(', ') });
        }
        
        if (command.usage) {
            commandEmbed.addFields({ name: 'Usage', value: `${config.prefix}${command.name} ${command.usage}` });
        }
        
        message.reply({ embeds: [commandEmbed] });
    },
    
    async executeSlash(interaction, client) {
        const commandName = interaction.options.getString('command');
        const { commands } = client;
        const isOwner = permissionManager.isOwner(interaction.user.id);
        const isServerOwner = interaction.guild && interaction.user.id === interaction.guild.ownerId;
        const isAdmin = interaction.member && interaction.member.permissions.has('Administrator');

        if (!commandName) {
            const categories = {};
            
            commands.forEach(command => {
                // Filter commands based on permissions
                if (command.ownerOnly && !isOwner) {
                    return; // Skip owner-only commands
                }
                
                // Skip commands that require server owner if user isn't the owner
                if (command.serverOwnerOnly && !isServerOwner && !isOwner) {
                    return;
                }
                
                // Skip admin commands if user isn't an admin
                if (command.adminOnly && !isAdmin && !isServerOwner && !isOwner) {
                    return;
                }
                
                // Check role requirements
                if (interaction.guild && command.name && !this.hasRequiredRoleSlash(interaction, command.name)) {
                    return;
                }
                
                const category = command.category || 'Uncategorized';
                
                if (!categories[category]) {
                    categories[category] = [];
                }
                
                categories[category].push(command);
            });
            
            const helpEmbed = createEmbed({
                title: 'Command Help',
                description: `Use \`/help command:[command name]\` to get info on a specific command.`,
                type: 'info'
            });

            for (const [category, cmds] of Object.entries(categories)) {
                // Skip empty categories (might happen if all commands were hidden)
                if (cmds.length === 0) continue;
                
                helpEmbed.addFields({
                    name: `📁 ${category.charAt(0).toUpperCase() + category.slice(1)}`,
                    value: cmds.map(cmd => `\`${cmd.name}\`: ${cmd.description}`).join('\n')
                });
            }
            
            return interaction.reply({ embeds: [helpEmbed] });
        }
        
        const command = commands.get(commandName.toLowerCase());
        
        if (!command) {
            return interaction.reply({ 
                embeds: [createEmbed({
                    title: 'Command Not Found',
                    description: `Could not find command \`${commandName}\`.`,
                    type: 'error'
                })],
                ephemeral: true
            });
        }
        
        // Check if user has permission to see this command
        if ((command.ownerOnly && !isOwner) || 
            (command.serverOwnerOnly && !isServerOwner && !isOwner) ||
            (command.adminOnly && !isAdmin && !isServerOwner && !isOwner) ||
            (interaction.guild && !this.hasRequiredRoleSlash(interaction, command.name))) {
            return interaction.reply({ 
                embeds: [createEmbed({
                    title: 'Command Not Found',
                    description: `Could not find command \`${commandName}\`.`,
                    type: 'error'
                })],
                ephemeral: true
            });
        }
        
        const commandEmbed = createEmbed({
            title: `Command: ${command.name}`,
            description: command.description,
            type: 'info'
        });
        
        if (command.aliases) {
            commandEmbed.addFields({ name: 'Aliases', value: command.aliases.join(', ') });
        }
        
        if (command.usage) {
            commandEmbed.addFields({ name: 'Usage', value: `${config.prefix}${command.name} ${command.usage}` });
        }
        
        interaction.reply({ embeds: [commandEmbed] });
    },
    
    // Helper method to check if a user has a required role for a command
    hasRequiredRole(message, commandName) {
        // Bot owners bypass role checks
        if (permissionManager.isOwner(message.author.id)) {
            return true;
        }
        
        // If not in a guild or no member, consider no role requirements
        if (!message.guild || !message.member) {
            return true;
        }
        
        // Get user's roles
        const memberRoles = message.member.roles.cache.map(role => role.id);
        
        // Check if the command has role requirements
        if (permissionManager.hasCommandRoleRequirements(commandName, message.guild.id)) {
            const requiredRoles = permissionManager.getCommandRoles(commandName, message.guild.id);
            // If the user has any of the required roles, they're authorized
            return memberRoles.some(roleId => requiredRoles.includes(roleId));
        }
        
        // Check if the command's category has role requirements
        const category = permissionManager.getCommandCategory(commandName);
        if (category && permissionManager.hasCategoryRoleRequirements(category, message.guild.id)) {
            const requiredRoles = permissionManager.getCategoryRoles(category, message.guild.id);
            // If the user has any of the required roles, they're authorized
            return memberRoles.some(roleId => requiredRoles.includes(roleId));
        }
        
        // If no role requirements, consider it allowed
        return true;
    },
    
    // Helper method for slash commands
    hasRequiredRoleSlash(interaction, commandName) {
        // Bot owners bypass role checks
        if (permissionManager.isOwner(interaction.user.id)) {
            return true;
        }
        
        // If not in a guild or no member, consider no role requirements
        if (!interaction.guild || !interaction.member) {
            return true;
        }
        
        // Get user's roles
        const memberRoles = interaction.member.roles.cache.map(role => role.id);
        
        // Check if the command has role requirements
        if (permissionManager.hasCommandRoleRequirements(commandName, interaction.guild.id)) {
            const requiredRoles = permissionManager.getCommandRoles(commandName, interaction.guild.id);
            // If the user has any of the required roles, they're authorized
            return memberRoles.some(roleId => requiredRoles.includes(roleId));
        }
        
        // Check if the command's category has role requirements
        const category = permissionManager.getCommandCategory(commandName);
        if (category && permissionManager.hasCategoryRoleRequirements(category, interaction.guild.id)) {
            const requiredRoles = permissionManager.getCategoryRoles(category, interaction.guild.id);
            // If the user has any of the required roles, they're authorized
            return memberRoles.some(roleId => requiredRoles.includes(roleId));
        }
        
        // If no role requirements, consider it allowed
        return true;
    }
};