const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const { createEmbed } = require('../../utils/embedBuilder');
const logger = require('../../utils/logger');
const permissionManager = require('../../utils/permissionManager');

module.exports = {
    name: 'smartrole',
    description: 'Advanced role management with multiple conditions (bot owner only)',
    usage: '<add/remove> <role_to_modify> <from/without> <target_role>',
    category: 'utility',
    ownerOnly: true,
    
    slashCommand: new SlashCommandBuilder()
        .setName('smartrole')
        .setDescription('Advanced role management with multiple conditions (bot owner only)')
        .addStringOption(option =>
            option.setName('action')
                .setDescription('Whether to add or remove the role')
                .setRequired(true)
                .addChoices(
                    { name: 'Add Role', value: 'add' },
                    { name: 'Remove Role', value: 'remove' }
                ))
        .addRoleOption(option =>
            option.setName('role_to_modify')
                .setDescription('The role to add or remove')
                .setRequired(true))
        .addStringOption(option =>
            option.setName('target_type')
                .setDescription('Target users with or without the specified role')
                .setRequired(true)
                .addChoices(
                    { name: 'FROM users who have role', value: 'from' },
                    { name: 'FROM users who lack role', value: 'without' }
                ))
        .addRoleOption(option =>
            option.setName('target_role')
                .setDescription('The role to check for targeting users')
                .setRequired(true))
        .addBooleanOption(option =>
            option.setName('dryrun')
                .setDescription('Preview changes without applying them')
                .setRequired(false)),
    
    async execute(message, args, client) {
        // Check if user is a bot owner
        if (!permissionManager.isOwner(message.author.id)) {
            return;
        }
        
        if (args.length < 4) {
            return message.reply({ 
                embeds: [createEmbed({
                    title: 'Missing Arguments',
                    description: `Usage: \`!${this.name} ${this.usage}\`\n\n**Examples:**\n• \`!smartrole remove @PUPIAN without @IDVERIFIED\` - Remove PUPIAN from users who lack IDVERIFIED\n• \`!smartrole add @Verified from @Pending\` - Add Verified to users who have Pending`,
                    type: 'error'
                })]
            });
        }
        
        const action = args[0].toLowerCase();
        const roleToModifyArg = args[1];
        const targetType = args[2].toLowerCase();
        const targetRoleArg = args[3];
        
        if (!['add', 'remove'].includes(action)) {
            return message.reply({ 
                embeds: [createEmbed({
                    title: 'Invalid Action',
                    description: 'Action must be either `add` or `remove`.',
                    type: 'error'
                })]
            });
        }
        
        if (!['from', 'without'].includes(targetType)) {
            return message.reply({ 
                embeds: [createEmbed({
                    title: 'Invalid Target Type',
                    description: 'Target type must be either `from` (users who have the role) or `without` (users who lack the role).',
                    type: 'error'
                })]
            });
        }
        
        // Resolve role to modify
        let roleToModify = message.mentions.roles.first();
        if (!roleToModify) {
            roleToModify = message.guild.roles.cache.find(r => 
                r.name.toLowerCase() === roleToModifyArg.toLowerCase() || 
                r.id === roleToModifyArg.replace(/[<@&>]/g, '')
            );
        }
        
        if (!roleToModify) {
            return message.reply({ 
                embeds: [createEmbed({
                    title: 'Role to Modify Not Found',
                    description: 'Could not find the role to modify. Please mention the role or use its exact name.',
                    type: 'error'
                })]
            });
        }
        
        // Resolve target role
        let targetRole;
        const mentionedRoles = Array.from(message.mentions.roles.values());
        if (mentionedRoles.length > 1) {
            targetRole = mentionedRoles[1];
        } else {
            targetRole = message.guild.roles.cache.find(r => 
                r.name.toLowerCase() === targetRoleArg.toLowerCase() || 
                r.id === targetRoleArg.replace(/[<@&>]/g, '')
            );
        }
        
        if (!targetRole) {
            return message.reply({ 
                embeds: [createEmbed({
                    title: 'Target Role Not Found',
                    description: 'Could not find the target role. Please mention the role or use its exact name.',
                    type: 'error'
                })]
            });
        }
        
        await this.processSmartRole(message, action, roleToModify, targetType, targetRole, false);
    },
    
    async executeSlash(interaction, client) {
        // Check if user is a bot owner
        if (!permissionManager.isOwner(interaction.user.id)) {
            return interaction.reply({ 
                embeds: [createEmbed({
                    title: 'Permission Denied',
                    description: 'This command is restricted to bot owners only.',
                    type: 'error'
                })],
                ephemeral: true
            });
        }
        
        const action = interaction.options.getString('action');
        const roleToModify = interaction.options.getRole('role_to_modify');
        const targetType = interaction.options.getString('target_type');
        const targetRole = interaction.options.getRole('target_role');
        const dryRun = interaction.options.getBoolean('dryrun') || false;
        
        await interaction.deferReply();
        await this.processSmartRole(interaction, action, roleToModify, targetType, targetRole, dryRun);
    },
    
    async processSmartRole(context, action, roleToModify, targetType, targetRole, dryRun) {
        const guild = context.guild;
        const isInteraction = context.isCommand && context.isCommand() || context.commandName !== undefined;
        
        try {
            // Check if bot can manage the role to modify
            if (roleToModify.position >= guild.members.me.roles.highest.position) {
                const embed = createEmbed({
                    title: 'Role Hierarchy Error',
                    description: 'I cannot manage the role to modify because it is higher than or equal to my highest role.',
                    type: 'error'
                });
                
                return isInteraction ? 
                    await context.editReply({ embeds: [embed] }) : 
                    await context.reply({ embeds: [embed] });
            }
            
            // Fetch all members
            const members = await guild.members.fetch();
            
            // Filter members based on target type
            let targetMembers;
            if (targetType === 'from') {
                // Find members who HAVE the target role
                targetMembers = members.filter(member => {
                    return !member.user.bot && member.roles.cache.has(targetRole.id);
                });
            } else { // targetType === 'without'
                // Find members who DON'T HAVE the target role
                targetMembers = members.filter(member => {
                    return !member.user.bot && !member.roles.cache.has(targetRole.id);
                });
            }
            
            if (targetMembers.size === 0) {
                const targetText = targetType === 'from' ? 'have' : 'lack';
                const embed = createEmbed({
                    title: 'No Target Members Found',
                    description: `No members found who ${targetText} the role **${targetRole.name}**.`,
                    type: 'warning'
                });
                
                return isInteraction ? 
                    await context.editReply({ embeds: [embed] }) : 
                    await context.reply({ embeds: [embed] });
            }
            
            // Filter members who need the role modification
            let membersToUpdate;
            if (action === 'add') {
                // Only include members who don't already have the role
                membersToUpdate = targetMembers.filter(member => {
                    return !member.roles.cache.has(roleToModify.id);
                });
            } else { // action === 'remove'
                // Only include members who currently have the role
                membersToUpdate = targetMembers.filter(member => {
                    return member.roles.cache.has(roleToModify.id);
                });
            }
            
            // Show preview
            if (dryRun) {
                const actionText = action === 'add' ? 'receive' : 'lose';
                const targetText = targetType === 'from' ? 'have' : 'lack';
                
                const previewEmbed = createEmbed({
                    title: 'Preview Smart Role Operation',
                    description: `**Target:** Members who ${targetText} **${targetRole.name}** (${targetMembers.size} members)\n**Action:** ${action.toUpperCase()} role **${roleToModify.name}**\n**Members to Update:** ${membersToUpdate.size}`,
                    type: 'info',
                    fields: [
                        {
                            name: `Members who will ${actionText} ${roleToModify.name}`,
                            value: membersToUpdate.size > 0 ? 
                                membersToUpdate.first(10).map(m => `• ${m.displayName} (${m.user.tag})`).join('\n') + 
                                (membersToUpdate.size > 10 ? `\n... and ${membersToUpdate.size - 10} more` : '') :
                                `No members need this role ${action === 'add' ? 'added' : 'removed'} (they ${action === 'add' ? 'already have it' : "don't have it"})`,
                            inline: false
                        }
                    ]
                });
                
                return isInteraction ? 
                    await context.editReply({ embeds: [previewEmbed] }) : 
                    await context.reply({ embeds: [previewEmbed] });
            }
            
            // Check if any changes are needed
            if (membersToUpdate.size === 0) {
                const actionText = action === 'add' ? 'already have' : "don't have";
                const embed = createEmbed({
                    title: 'No Changes Required',
                    description: `All qualifying members ${actionText} the role **${roleToModify.name}**.`,
                    type: 'info'
                });
                
                return isInteraction ? 
                    await context.editReply({ embeds: [embed] }) : 
                    await context.reply({ embeds: [embed] });
            }
            
            // Show confirmation
            const actionText = action === 'add' ? 'add' : 'remove';
            const targetText2 = targetType === 'from' ? 'have' : 'lack';
            
            const confirmEmbed = createEmbed({
                title: '⚠️ Confirmation Required',
                description: `You are about to ${actionText} the role **${roleToModify.name}** ${action === 'add' ? 'to' : 'from'} **${membersToUpdate.size}** member(s) who ${targetText2} the role **${targetRole.name}**.\n\n**This action cannot be undone.**`,
                type: 'warning',
                fields: [
                    {
                        name: 'Sample Members',
                        value: membersToUpdate.first(5).map(m => `• ${m.displayName} (${m.user.tag})`).join('\n') + 
                               (membersToUpdate.size > 5 ? `\n... and ${membersToUpdate.size - 5} more` : ''),
                        inline: false
                    }
                ]
            });
            
            // Confirmation logic (similar to existing commands)
            let confirmMessage;
            if (isInteraction) {
                await context.editReply({
                    embeds: [confirmEmbed],
                    components: [
                        {
                            type: 1,
                            components: [
                                {
                                    type: 2,
                                    style: 4,
                                    customId: 'smartrole_confirm',
                                    label: 'CONFIRM CHANGES'
                                },
                                {
                                    type: 2,
                                    style: 2,
                                    customId: 'smartrole_cancel',
                                    label: 'Cancel'
                                }
                            ]
                        }
                    ]
                });
                
                try {
                    const filter = i => i.customId.startsWith('smartrole_') && i.user.id === context.user.id;
                    const buttonResponse = await context.channel.awaitMessageComponent({
                        filter,
                        time: 30000
                    });
                    
                    if (buttonResponse.customId === 'smartrole_cancel') {
                        return await buttonResponse.update({
                            embeds: [createEmbed({
                                title: 'Operation Cancelled',
                                description: 'Smart role operation cancelled.',
                                type: 'info'
                            })],
                            components: []
                        });
                    }
                    
                    await buttonResponse.update({
                        embeds: [createEmbed({
                            title: 'Processing Changes',
                            description: `${action === 'add' ? 'Adding' : 'Removing'} roles... This may take a while.`,
                            type: 'info'
                        })],
                        components: []
                    });
                    
                } catch (error) {
                    return await context.editReply({
                        embeds: [createEmbed({
                            title: 'Operation Cancelled',
                            description: 'Smart role operation cancelled due to timeout.',
                            type: 'info'
                        })],
                        components: []
                    });
                }
            } else {
                confirmMessage = await context.reply({ embeds: [confirmEmbed] });
                
                try {
                    const filter = m => m.author.id === context.author.id && m.content.toLowerCase() === 'confirm';
                    const collected = await context.channel.awaitMessages({ 
                        filter, 
                        max: 1, 
                        time: 30000, 
                        errors: ['time'] 
                    });
                    
                    await context.channel.send({
                        embeds: [createEmbed({
                            title: 'Processing Changes',
                            description: `${action === 'add' ? 'Adding' : 'Removing'} roles... This may take a while.`,
                            type: 'info'
                        })]
                    });
                    
                } catch (error) {
                    return await confirmMessage.edit({
                        embeds: [createEmbed({
                            title: 'Operation Cancelled',
                            description: 'Smart role operation cancelled due to timeout.',
                            type: 'info'
                        })]
                    });
                }
            }
            
            // Apply changes
            let successful = 0;
            let failed = 0;
            const errors = [];
            
            for (const member of membersToUpdate.values()) {
                const result = await this.modifyRoleWithRetry(
                    member, 
                    roleToModify, 
                    action,
                    `Smart role ${action} by ${isInteraction ? context.user.tag : context.author.tag}`
                );
                
                if (result.success) {
                    successful++;
                } else {
                    failed++;
                    errors.push(`${member.user.tag}: ${result.error}`);
                    logger.error(`Failed to ${action} role ${action === 'add' ? 'to' : 'from'} ${member.user.tag}:`, result.error);
                }
                
                // Add small delay to avoid rate limits
                await new Promise(resolve => setTimeout(resolve, 100));
            }
            
            // Report results
            const targetText3 = targetType === 'from' ? 'have' : 'lack';
            const resultEmbed = createEmbed({
                title: 'Smart Role Operation Complete',
                description: `**Target:** Members who ${targetText3} **${targetRole.name}**\n**Action:** ${action.toUpperCase()} role **${roleToModify.name}**\n**Successful:** ${successful}\n**Failed:** ${failed}`,
                type: successful > 0 ? 'success' : 'error',
                fields: errors.length > 0 ? [
                    {
                        name: 'Errors',
                        value: errors.slice(0, 5).join('\n') + (errors.length > 5 ? `\n... and ${errors.length - 5} more` : ''),
                        inline: false
                    }
                ] : []
            });
            
            if (isInteraction) {
                await context.editReply({ embeds: [resultEmbed] });
            } else {
                await context.channel.send({ embeds: [resultEmbed] });
            }
            
            logger.info(`${isInteraction ? context.user.tag : context.author.tag} completed smart role operation: ${successful} successful, ${failed} failed`);
            
        } catch (error) {
            logger.error('Error in smart role operation:', error);
            
            const errorEmbed = createEmbed({
                title: 'Error',
                description: `An error occurred during the smart role operation: ${error.message}`,
                type: 'error'
            });
            
            if (isInteraction) {
                await context.editReply({ embeds: [errorEmbed] });
            } else {
                await context.reply({ embeds: [errorEmbed] });
            }
        }
    },

    // Helper method for better rate limiting and error handling
    async modifyRoleWithRetry(member, role, action, reason, maxRetries = 3) {
        for (let attempt = 1; attempt <= maxRetries; attempt++) {
            try {
                if (action === 'add') {
                    await member.roles.add(role, reason);
                } else {
                    await member.roles.remove(role, reason);
                }
                return { success: true, error: null };
            } catch (error) {
                if (attempt === maxRetries) {
                    return { success: false, error: error.message };
                }
                
                // Wait longer between retries for rate limit errors
                const delay = error.code === 50013 ? 1000 : 200 * attempt;
                await new Promise(resolve => setTimeout(resolve, delay));
            }
        }
    },
};
