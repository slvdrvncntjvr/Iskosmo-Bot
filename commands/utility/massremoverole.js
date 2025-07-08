const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const { createEmbed } = require('../../utils/embedBuilder');
const logger = require('../../utils/logger');
const permissionManager = require('../../utils/permissionManager');

module.exports = {
    name: 'massremoverole',
    description: 'Remove role from users who have a specific role (bot owner only)',
    usage: '<target_role> <role_to_remove>',
    category: 'utility',
    ownerOnly: true,
    
    slashCommand: new SlashCommandBuilder()
        .setName('massremoverole')
        .setDescription('Remove role from users who have a specific role (bot owner only)')
        .addRoleOption(option =>
            option.setName('target_role')
                .setDescription('The role that users must have to get the role removed')
                .setRequired(true))
        .addRoleOption(option =>
            option.setName('role_to_remove')
                .setDescription('The role to remove from users who have the target role')
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
        
        if (args.length < 2) {
            return message.reply({ 
                embeds: [createEmbed({
                    title: 'Missing Arguments',
                    description: `Usage: \`!${this.name} ${this.usage}\`\n\n**Example:**\n• \`!massremoverole @ID-2024 @ID-2025\` - Remove @ID-2024 role from all users with @ID-2025 role`,
                    type: 'error'
                })]
            });
        }
        
        const roleToRemoveArg = args[0];
        const targetRoleArg = args[1];
        
        // Try to resolve role to remove
        let roleToRemove = message.mentions.roles.first();
        if (!roleToRemove) {
            roleToRemove = message.guild.roles.cache.find(r => 
                r.name.toLowerCase() === roleToRemoveArg.toLowerCase() || 
                r.id === roleToRemoveArg.replace(/[<@&>]/g, '')
            );
        }
        
        if (!roleToRemove) {
            return message.reply({ 
                embeds: [createEmbed({
                    title: 'Role to Remove Not Found',
                    description: 'Could not find the role to remove. Please mention the role or use its exact name.',
                    type: 'error'
                })]
            });
        }
        
        // Try to resolve target role
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
        
        await this.processRoleRemoval(message, roleToRemove, targetRole, false);
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
        
        const roleToRemove = interaction.options.getRole('role_to_remove');
        const targetRole = interaction.options.getRole('target_role');
        const dryRun = interaction.options.getBoolean('dryrun') || false;
        
        await interaction.deferReply();
        await this.processRoleRemoval(interaction, roleToRemove, targetRole, dryRun);
    },
    
    async processRoleRemoval(context, roleToRemove, targetRole, dryRun) {
        const guild = context.guild;
        const isInteraction = context.isCommand && context.isCommand() || context.commandName !== undefined;
        
        try {
            // Check if bot can manage the role to remove
            if (roleToRemove.position >= guild.members.me.roles.highest.position) {
                const embed = createEmbed({
                    title: 'Role Hierarchy Error',
                    description: 'I cannot manage the role to remove because it is higher than or equal to my highest role.',
                    type: 'error'
                });
                
                return isInteraction ? 
                    await context.editReply({ embeds: [embed] }) : 
                    await context.reply({ embeds: [embed] });
            }
            
            // Fetch all members
            const members = await guild.members.fetch();
            
            // Find members who have the target role
            const targetMembers = members.filter(member => {
                return !member.user.bot && member.roles.cache.has(targetRole.id);
            });
            
            if (targetMembers.size === 0) {
                const embed = createEmbed({
                    title: 'No Target Members Found',
                    description: `No members found with the role **${targetRole.name}**.`,
                    type: 'warning'
                });
                
                return isInteraction ? 
                    await context.editReply({ embeds: [embed] }) : 
                    await context.reply({ embeds: [embed] });
            }
            
            // Filter members who have the role to remove
            const membersToUpdate = targetMembers.filter(member => {
                return member.roles.cache.has(roleToRemove.id);
            });
            
            // Show preview
            if (dryRun) {
                const previewEmbed = createEmbed({
                    title: 'Preview Role Removal',
                    description: `**Target Role:** ${targetRole.name} (${targetMembers.size} members)\n**Role to Remove:** ${roleToRemove.name}\n**Members to Update:** ${membersToUpdate.size}`,
                    type: 'info',
                    fields: [
                        {
                            name: `Members who will lose ${roleToRemove.name}`,
                            value: membersToUpdate.size > 0 ? 
                                membersToUpdate.first(10).map(m => `• ${m.displayName} (${m.user.tag})`).join('\n') + 
                                (membersToUpdate.size > 10 ? `\n... and ${membersToUpdate.size - 10} more` : '') :
                                'No members need this role removed (they don\'t have it)',
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
                const embed = createEmbed({
                    title: 'No Changes Required',
                    description: `No members with **${targetRole.name}** have the role **${roleToRemove.name}**.`,
                    type: 'info'
                });
                
                return isInteraction ? 
                    await context.editReply({ embeds: [embed] }) : 
                    await context.reply({ embeds: [embed] });
            }
            
            // Show confirmation
            const confirmEmbed = createEmbed({
                title: '⚠️ Confirmation Required',
                description: `You are about to remove the role **${roleToRemove.name}** from **${membersToUpdate.size}** member(s) who have the role **${targetRole.name}**.\n\n**This action cannot be undone.**`,
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
                                    customId: 'massremoverole_confirm',
                                    label: 'CONFIRM CHANGES'
                                },
                                {
                                    type: 2,
                                    style: 2,
                                    customId: 'massremoverole_cancel',
                                    label: 'Cancel'
                                }
                            ]
                        }
                    ]
                });
                
                try {
                    const filter = i => i.customId.startsWith('massremoverole_') && i.user.id === context.user.id;
                    const buttonResponse = await context.channel.awaitMessageComponent({
                        filter,
                        time: 30000
                    });
                    
                    if (buttonResponse.customId === 'massremoverole_cancel') {
                        return await buttonResponse.update({
                            embeds: [createEmbed({
                                title: 'Operation Cancelled',
                                description: 'Mass role removal operation cancelled.',
                                type: 'info'
                            })],
                            components: []
                        });
                    }
                    
                    await buttonResponse.update({
                        embeds: [createEmbed({
                            title: 'Processing Changes',
                            description: 'Removing roles... This may take a while.',
                            type: 'info'
                        })],
                        components: []
                    });
                    
                } catch (error) {
                    return await context.editReply({
                        embeds: [createEmbed({
                            title: 'Operation Cancelled',
                            description: 'Mass role removal operation cancelled due to timeout.',
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
                            description: 'Removing roles... This may take a while.',
                            type: 'info'
                        })]
                    });
                    
                } catch (error) {
                    return await confirmMessage.edit({
                        embeds: [createEmbed({
                            title: 'Operation Cancelled',
                            description: 'Mass role removal operation cancelled due to timeout.',
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
                const result = await this.removeRoleWithRetry(
                    member, 
                    roleToRemove, 
                    `Mass role removal by ${isInteraction ? context.user.tag : context.author.tag}`
                );
                
                if (result.success) {
                    successful++;
                } else {
                    failed++;
                    errors.push(`${member.user.tag}: ${result.error}`);
                    logger.error(`Failed to remove role from ${member.user.tag}:`, result.error);
                }
                
                // Add small delay to avoid rate limits
                await new Promise(resolve => setTimeout(resolve, 100));
            }
            
            // Report results
            const resultEmbed = createEmbed({
                title: 'Mass Role Removal Complete',
                description: `**Target Role:** ${targetRole.name}\n**Removed Role:** ${roleToRemove.name}\n**Successful:** ${successful}\n**Failed:** ${failed}`,
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
            
            logger.info(`${isInteraction ? context.user.tag : context.author.tag} completed mass role removal: ${successful} successful, ${failed} failed`);
            
        } catch (error) {
            logger.error('Error in mass role removal operation:', error);
            
            const errorEmbed = createEmbed({
                title: 'Error',
                description: `An error occurred during the mass role removal operation: ${error.message}`,
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
    async removeRoleWithRetry(member, role, reason, maxRetries = 3) {
        for (let attempt = 1; attempt <= maxRetries; attempt++) {
            try {
                await member.roles.remove(role, reason);
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
