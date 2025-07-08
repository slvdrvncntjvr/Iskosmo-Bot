const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const { createEmbed } = require('../../utils/embedBuilder');
const logger = require('../../utils/logger');
const permissionManager = require('../../utils/permissionManager');

module.exports = {
    name: 'massnick',
    description: 'Mass update nicknames with smart year progression (bot owner only)',
    usage: '[filter]',
    category: 'utility',
    ownerOnly: true,
    
    slashCommand: new SlashCommandBuilder()
        .setName('massnick')
        .setDescription('Mass update nicknames with smart year progression (bot owner only)')
        .addStringOption(option =>
            option.setName('filter')
                .setDescription('Filter users by course (e.g., BSIT, BSCS) or year (e.g., 1, 2)')
                .setRequired(false))
        .addBooleanOption(option =>
            option.setName('dryrun')
                .setDescription('Preview changes without applying them')
                .setRequired(false)),
    
    async execute(message, args, client) {
        // Check if user is a bot owner
        if (!permissionManager.isOwner(message.author.id)) {
            return message.reply({
                embeds: [createEmbed({
                    title: 'Permission Denied',
                    description: 'This command is restricted to bot owners only.',
                    type: 'error'
                })],
                ephemeral: true
            });
        }
        
        const filter = args.join(' ') || null;
        
        await this.processNicknameUpdate(message, filter, false);
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
        
        const filter = interaction.options.getString('filter');
        const dryRun = interaction.options.getBoolean('dryrun') || false;
        
        await interaction.deferReply();
        await this.processNicknameUpdate(interaction, filter, dryRun);
    },
    
    async processNicknameUpdate(context, filter, dryRun) {
        const guild = context.guild;
        const isInteraction = context.isCommand ? context.isCommand() : !!context.commandName;
        
        try {
            // Fetch all members
            const members = await guild.members.fetch();
            
            // Filter members with the expected nickname format
            const validMembers = members.filter(member => {
                if (!member.nickname) return false;
                
                // Check if nickname follows the format: "Name | COURSE YEAR-SECTION"
                const nicknamePattern = /^(.+?)\s*\|\s*([A-Z]+)\s+(\d+)-(\d+)$/;
                const match = member.nickname.match(nicknamePattern);
                
                if (!match) return false;
                
                const [, name, course, year, section] = match;
                
                // Apply filter if specified
                if (filter) {
                    const filterLower = filter.toLowerCase();
                    const courseLower = course.toLowerCase();
                    const yearStr = year.toString();
                    
                    // Check if filter matches course or year
                    if (!courseLower.includes(filterLower) && yearStr !== filter) {
                        return false;
                    }
                }
                
                return true;
            });
            
            if (validMembers.size === 0) {
                const embed = createEmbed({
                    title: 'No Valid Members Found',
                    description: 'No members found with the expected nickname format (Name | COURSE YEAR-SECTION)' + (filter ? ` matching filter: ${filter}` : ''),
                    type: 'warning'
                });
                
                return isInteraction ? 
                    await context.editReply({ embeds: [embed] }) : 
                    await context.reply({ embeds: [embed] });
            }
            
            // Process changes - advance year by 1
            const changes = [];
            
            for (const [, member] of validMembers) {
                const nicknamePattern = /^(.+?)\s*\|\s*([A-Z]+)\s+(\d+)-(\d+)$/;
                const match = member.nickname.match(nicknamePattern);
                
                if (!match) continue;
                
                const [, name, course, year, section] = match;
                const currentYear = parseInt(year);
                const newYear = currentYear + 1;
                
                // Only advance if not already at max year (4)
                if (newYear <= 4) {
                    const newNickname = `${name} | ${course} ${newYear}-${section}`;
                    
                    changes.push({
                        member,
                        oldNickname: member.nickname,
                        newNickname,
                        currentYear,
                        newYear
                    });
                }
            }
            
            // Show preview
            if (dryRun) {
                const previewEmbed = createEmbed({
                    title: 'Preview Year Progression',
                    description: `Found ${validMembers.size} valid members${filter ? ` (filtered by: ${filter})` : ''}\n**${changes.length}** members will be advanced by 1 year`,
                    type: 'info',
                    fields: changes.slice(0, 10).map(change => ({
                        name: change.member.user.tag,
                        value: `${change.oldNickname} → ${change.newNickname}`,
                        inline: false
                    }))
                });
                
                if (changes.length > 10) {
                    previewEmbed.setFooter({ text: `... and ${changes.length - 10} more members` });
                }
                
                return isInteraction ? 
                    await context.editReply({ embeds: [previewEmbed] }) : 
                    await context.reply({ embeds: [previewEmbed] });
            }
            
            // Check if any changes are needed
            if (changes.length === 0) {
                const embed = createEmbed({
                    title: 'No Changes Required',
                    description: 'All members are already at year 4 (maximum) or no valid members found.',
                    type: 'info'
                });
                
                return isInteraction ? 
                    await context.editReply({ embeds: [embed] }) : 
                    await context.reply({ embeds: [embed] });
            }
            
            // Show confirmation
            const confirmEmbed = createEmbed({
                title: '⚠️ Confirmation Required',
                description: `You are about to advance **${changes.length}** student(s) by 1 year.\n\n${filter ? `**Filter:** ${filter}\n` : ''}**This action cannot be undone.**`,
                type: 'warning',
                fields: [
                    {
                        name: 'Year Progression Summary',
                        value: this.getYearProgressionSummary(changes),
                        inline: false
                    },
                    {
                        name: 'Sample Changes',
                        value: changes.slice(0, 5).map(c => `• ${c.oldNickname} → ${c.newNickname}`).join('\n') + 
                               (changes.length > 5 ? `\n... and ${changes.length - 5} more` : ''),
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
                                    customId: 'massnick_confirm',
                                    label: 'CONFIRM YEAR PROGRESSION'
                                },
                                {
                                    type: 2,
                                    style: 2,
                                    customId: 'massnick_cancel',
                                    label: 'Cancel'
                                }
                            ]
                        }
                    ]
                });
                
                try {
                    const filter = i => i.customId.startsWith('massnick_') && i.user.id === context.user.id;
                    const buttonResponse = await context.channel.awaitMessageComponent({
                        filter,
                        time: 30000
                    });
                    
                    if (buttonResponse.customId === 'massnick_cancel') {
                        return await buttonResponse.update({
                            embeds: [createEmbed({
                                title: 'Operation Cancelled',
                                description: 'Year progression cancelled.',
                                type: 'info'
                            })],
                            components: []
                        });
                    }
                    
                    await buttonResponse.update({
                        embeds: [createEmbed({
                            title: 'Processing Year Progression',
                            description: 'Updating nicknames... This may take a while.',
                            type: 'info'
                        })],
                        components: []
                    });
                    
                } catch (error) {
                    return await context.editReply({
                        embeds: [createEmbed({
                            title: 'Operation Cancelled',
                            description: 'Year progression cancelled due to timeout.',
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
                            title: 'Processing Year Progression',
                            description: 'Updating nicknames... This may take a while.',
                            type: 'info'
                        })]
                    });
                    
                } catch (error) {
                    return await confirmMessage.edit({
                        embeds: [createEmbed({
                            title: 'Operation Cancelled',
                            description: 'Year progression cancelled due to timeout.',
                            type: 'info'
                        })]
                    });
                }
            }
            
            // Apply changes
            let successful = 0;
            let failed = 0;
            const errors = [];
            
            for (const change of changes) {
                try {
                    await change.member.setNickname(change.newNickname, 'Year progression');
                    successful++;
                    
                    // Add small delay to avoid rate limits
                    await new Promise(resolve => setTimeout(resolve, 100));
                    
                } catch (error) {
                    failed++;
                    errors.push(`${change.member.user.tag}: ${error.message}`);
                    logger.error(`Failed to update nickname for ${change.member.user.tag}:`, error);
                }
            }
            
            // Report results
            const resultEmbed = createEmbed({
                title: 'Year Progression Complete',
                description: `**Successful:** ${successful}\n**Failed:** ${failed}\n\n${this.getYearProgressionSummary(changes.slice(0, successful))}`,
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
            
            logger.info(`${isInteraction ? context.user.tag : context.author.tag} completed year progression: ${successful} successful, ${failed} failed`);
            
        } catch (error) {
            logger.error('Error in year progression:', error);
            
            const errorEmbed = createEmbed({
                title: 'Error',
                description: `An error occurred during year progression: ${error.message}`,
                type: 'error'
            });
            
            if (isInteraction) {
                await context.editReply({ embeds: [errorEmbed] });
            } else {
                await context.reply({ embeds: [errorEmbed] });
            }
        }
    },
    
    getYearProgressionSummary(changes) {
        const yearCounts = {};
        
        changes.forEach(change => {
            const transition = `${change.currentYear} → ${change.newYear}`;
            yearCounts[transition] = (yearCounts[transition] || 0) + 1;
        });
        
        return Object.entries(yearCounts)
            .map(([transition, count]) => `• Year ${transition}: ${count} student${count > 1 ? 's' : ''}`)
            .join('\n') || 'No changes';
    }
};
