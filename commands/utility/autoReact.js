// commands/utility/autoreact.js
const { SlashCommandBuilder } = require('discord.js');
const { createEmbed } = require('../../utils/embedBuilder');
const responseManager = require('../../utils/responseManager');
const logger = require('../../utils/logger');

module.exports = {
    name: 'autoreact',
    description: 'Create, list, or remove automatic reactions to specific triggers',
    usage: '<add/remove/list/info/toggle> [trigger] [emoji] [options]',
    category: 'utility',
    requiresAuth: true, // Only authorized users can manage auto-reactions
    
    slashCommand: new SlashCommandBuilder()
        .setName('autoreact')
        .setDescription('Manage automatic reactions to specific triggers')
        .addSubcommand(subcommand =>
            subcommand
                .setName('add')
                .setDescription('Add a new auto-reaction')
                .addStringOption(option => 
                    option.setName('trigger')
                        .setDescription('Word or phrase that triggers the reaction')
                        .setRequired(true))
                .addStringOption(option => 
                    option.setName('emoji')
                        .setDescription('Emoji to react with (standard emoji or custom emoji ID)')
                        .setRequired(true))
                .addStringOption(option => 
                    option.setName('match_type')
                        .setDescription('How to match the trigger')
                        .setRequired(false)
                        .addChoices(
                            { name: 'Contains', value: 'contains' },
                            { name: 'Exact Word', value: 'exact' },
                            { name: 'Starts With', value: 'startsWith' },
                            { name: 'Ends With', value: 'endsWith' }
                        ))
                .addBooleanOption(option => 
                    option.setName('case_sensitive')
                        .setDescription('Whether matching should be case-sensitive')
                        .setRequired(false))
                .addIntegerOption(option => 
                    option.setName('cooldown')
                        .setDescription('Cooldown in seconds between triggers (0 for no cooldown)')
                        .setRequired(false)
                        .setMinValue(0)
                        .setMaxValue(86400))) // Max 1 day
        .addSubcommand(subcommand =>
            subcommand
                .setName('remove')
                .setDescription('Remove an auto-reaction')
                .addStringOption(option => 
                    option.setName('trigger')
                        .setDescription('Trigger word/phrase to remove')
                        .setRequired(true))
                .addStringOption(option => 
                    option.setName('emoji')
                        .setDescription('Emoji to remove (leave blank to remove all for this trigger)')
                        .setRequired(false)))
        .addSubcommand(subcommand =>
            subcommand
                .setName('list')
                .setDescription('List all auto-reactions for this server'))
        .addSubcommand(subcommand =>
            subcommand
                .setName('info')
                .setDescription('Get detailed info about a specific auto-reaction')
                .addStringOption(option => 
                    option.setName('trigger')
                        .setDescription('Trigger word/phrase to get info about')
                        .setRequired(true))
                .addStringOption(option => 
                    option.setName('emoji')
                        .setDescription('Specific emoji to get info about')
                        .setRequired(true)))
        .addSubcommand(subcommand =>
            subcommand
                .setName('toggle')
                .setDescription('Enable or disable an auto-reaction')
                .addStringOption(option => 
                    option.setName('trigger')
                        .setDescription('Trigger word/phrase to toggle')
                        .setRequired(true))
                .addStringOption(option => 
                    option.setName('emoji')
                        .setDescription('Specific emoji to toggle')
                        .setRequired(true))),
    
    async execute(message, args, client) {
        if (!args.length) {
            return message.reply({
                embeds: [createEmbed({
                    title: 'Auto-React Help',
                    description: `Usage: \`!${this.name} ${this.usage}\``,
                    type: 'info',
                    fields: [
                        { name: 'Add', value: '`!autoreact add <trigger> <emoji> [match_type] [case_sensitive] [cooldown]`' },
                        { name: 'Remove', value: '`!autoreact remove <trigger> [emoji]`' },
                        { name: 'List', value: '`!autoreact list`' },
                        { name: 'Info', value: '`!autoreact info <trigger> <emoji>`' },
                        { name: 'Toggle', value: '`!autoreact toggle <trigger> <emoji>`' },
                        { name: 'Match Types', value: 'contains, exact, startsWith, endsWith' }
                    ]
                })]
            });
        }
        
        const subcommand = args[0].toLowerCase();
        
        if (subcommand === 'add') {
            if (args.length < 3) {
                return message.reply({
                    embeds: [createEmbed({
                        title: 'Error',
                        description: 'You need to provide both a trigger and an emoji.',
                        type: 'error'
                    })]
                });
            }
            
            const trigger = args[1];
            const emoji = args[2];
            
            // Validate emoji
            if (!this.isValidEmoji(emoji, message.guild)) {
                return message.reply({
                    embeds: [createEmbed({
                        title: 'Error',
                        description: 'Invalid emoji. Please provide a standard emoji or a custom emoji from this server.',
                        type: 'error'
                    })]
                });
            }
            
            // Parse options
            let options = {};
            
            // Check for options at the end (prefixed with --)
            for (let i = 3; i < args.length; i++) {
                if (args[i].startsWith('--')) {
                    const option = args[i].substring(2);
                    if (option === 'exact' || option === 'contains' || option === 'startsWith' || option === 'endsWith') {
                        options.matchType = option;
                    } else if (option === 'case-sensitive' || option === 'caseSensitive') {
                        options.caseSensitive = true;
                    } else if (option.startsWith('cooldown=')) {
                        const cooldown = parseInt(option.split('=')[1]);
                        if (!isNaN(cooldown) && cooldown >= 0) {
                            options.cooldown = cooldown;
                        }
                    }
                }
            }
            
            options.createdBy = message.author.id;
            
            const result = responseManager.addReact(
                message.guild.id,
                trigger,
                emoji,
                options
            );
            
            return message.reply({
                embeds: [createEmbed({
                    title: result === 'added' ? 'Auto-Reaction Added' : 'Auto-Reaction Updated',
                    description: `I'll now react with ${emoji} when I see "${trigger}"`,
                    type: 'success',
                    fields: [
                        { name: 'Match Type', value: options.matchType || 'contains', inline: true },
                        { name: 'Case Sensitive', value: options.caseSensitive ? 'Yes' : 'No', inline: true },
                        { name: 'Cooldown', value: `${options.cooldown || 0} seconds`, inline: true }
                    ]
                })]
            });
        }
        
        else if (subcommand === 'remove') {
            if (args.length < 2) {
                return message.reply({
                    embeds: [createEmbed({
                        title: 'Error',
                        description: 'You need to provide a trigger to remove.',
                        type: 'error'
                    })]
                });
            }
            
            const trigger = args[1];
            const emoji = args.length > 2 ? args[2] : null;
            
            const success = responseManager.removeReact(message.guild.id, trigger, emoji);
            
            if (success) {
                return message.reply({
                    embeds: [createEmbed({
                        title: 'Auto-Reaction Removed',
                        description: emoji 
                            ? `I'll no longer react with ${emoji} to "${trigger}"`
                            : `I'll no longer react to "${trigger}" with any emoji`,
                        type: 'success'
                    })]
                });
            } else {
                return message.reply({
                    embeds: [createEmbed({
                        title: 'Error',
                        description: emoji
                            ? `No auto-reaction found for trigger "${trigger}" with emoji ${emoji}`
                            : `No auto-reactions found for trigger "${trigger}"`,
                        type: 'error'
                    })]
                });
            }
        }
        
        else if (subcommand === 'list') {
            const reactions = responseManager.listReacts(message.guild.id);
            
            if (!reactions.length) {
                return message.reply({
                    embeds: [createEmbed({
                        title: 'Auto-Reactions',
                        description: 'No auto-reactions have been set up for this server.',
                        type: 'info'
                    })]
                });
            }
            
            // Group by trigger for more compact display
            const triggerGroups = {};
            reactions.forEach(reaction => {
                if (!triggerGroups[reaction.trigger]) {
                    triggerGroups[reaction.trigger] = [];
                }
                triggerGroups[reaction.trigger].push({
                    emoji: reaction.emoji,
                    enabled: reaction.enabled,
                    matchType: reaction.matchType
                });
            });
            
            // Create fields for each trigger group
            const embedFields = Object.keys(triggerGroups).map((trigger, index) => {
                const emojis = triggerGroups[trigger].map(r => 
                    `${r.emoji}${r.enabled ? '' : ' (Disabled)'}`).join(' ');
                const matchType = triggerGroups[trigger][0].matchType;
                
                return {
                    name: `${index + 1}. ${trigger}`,
                    value: `Emojis: ${emojis}\nMatch: ${matchType}`
                };
            });
            
            return message.reply({
                embeds: [createEmbed({
                    title: 'Auto-Reactions',
                    description: `This server has ${reactions.length} auto-reaction${reactions.length === 1 ? '' : 's'} across ${Object.keys(triggerGroups).length} trigger${Object.keys(triggerGroups).length === 1 ? '' : 's'}.`,
                    type: 'info',
                    fields: embedFields.slice(0, 25) // Discord limits to 25 fields
                })]
            });
        }
        
        else if (subcommand === 'info') {
            if (args.length < 3) {
                return message.reply({
                    embeds: [createEmbed({
                        title: 'Error',
                        description: 'You need to provide both a trigger and an emoji to get info about.',
                        type: 'error'
                    })]
                });
            }
            
            const trigger = args[1];
            const emoji = args[2];
            const reaction = responseManager.getReactDetails(message.guild.id, trigger, emoji);
            
            if (!reaction) {
                return message.reply({
                    embeds: [createEmbed({
                        title: 'Error',
                        description: `No auto-reaction found for trigger "${trigger}" with emoji ${emoji}`,
                        type: 'error'
                    })]
                });
            }
            
            return message.reply({
                embeds: [createEmbed({
                    title: `Auto-Reaction Info: ${reaction.trigger} → ${reaction.emoji}`,
                    description: `When I see "${reaction.trigger}", I'll react with ${reaction.emoji}`,
                    type: 'info',
                    fields: [
                        { name: 'Status', value: reaction.enabled ? 'Enabled' : 'Disabled', inline: true },
                        { name: 'Match Type', value: reaction.matchType, inline: true },
                        { name: 'Case Sensitive', value: reaction.caseSensitive ? 'Yes' : 'No', inline: true },
                        { name: 'Cooldown', value: `${reaction.cooldown} seconds`, inline: true },
                        { name: 'Created By', value: `<@${reaction.createdBy}>`, inline: true },
                        { name: 'Created At', value: new Date(reaction.createdAt).toLocaleString(), inline: true },
                        { name: 'Last Triggered', value: reaction.lastTriggered ? new Date(reaction.lastTriggered).toLocaleString() : 'Never', inline: true }
                    ]
                })]
            });
        }
        
        else if (subcommand === 'toggle') {
            if (args.length < 3) {
                return message.reply({
                    embeds: [createEmbed({
                        title: 'Error',
                        description: 'You need to provide both a trigger and an emoji to toggle.',
                        type: 'error'
                    })]
                });
            }
            
            const trigger = args[1];
            const emoji = args[2];
            const newState = responseManager.toggleReact(message.guild.id, trigger, emoji);
            
            if (newState === false && typeof newState !== 'boolean') {
                return message.reply({
                    embeds: [createEmbed({
                        title: 'Error',
                        description: `No auto-reaction found for trigger "${trigger}" with emoji ${emoji}`,
                        type: 'error'
                    })]
                });
            }
            
            return message.reply({
                embeds: [createEmbed({
                    title: 'Auto-Reaction Toggled',
                    description: `Auto-reaction "${trigger}" → ${emoji} is now ${newState ? 'enabled' : 'disabled'}.`,
                    type: 'success'
                })]
            });
        }
        
        else {
            return message.reply({
                embeds: [createEmbed({
                    title: 'Error',
                    description: `Unknown subcommand "${subcommand}". Use \`!${this.name}\` for help.`,
                    type: 'error'
                })]
            });
        }
    },
    
    async executeSlash(interaction, client) {
        const subcommand = interaction.options.getSubcommand();
        
        if (subcommand === 'add') {
            const trigger = interaction.options.getString('trigger');
            const emoji = interaction.options.getString('emoji');
            const matchType = interaction.options.getString('match_type') || 'contains';
            const caseSensitive = interaction.options.getBoolean('case_sensitive') || false;
            const cooldown = interaction.options.getInteger('cooldown') || 0;
            
            // Validate emoji
            if (!this.isValidEmoji(emoji, interaction.guild)) {
                return interaction.reply({
                    embeds: [createEmbed({
                        title: 'Error',
                        description: 'Invalid emoji. Please provide a standard emoji or a custom emoji from this server.',
                        type: 'error'
                    })],
                    ephemeral: true
                });
            }
            
            const options = {
                matchType,
                caseSensitive,
                cooldown,
                createdBy: interaction.user.id
            };
            
            const result = responseManager.addReact(
                interaction.guild.id,
                trigger,
                emoji,
                options
            );
            
            return interaction.reply({
                embeds: [createEmbed({
                    title: result === 'added' ? 'Auto-Reaction Added' : 'Auto-Reaction Updated',
                    description: `I'll now react with ${emoji} when I see "${trigger}"`,
                    type: 'success',
                    fields: [
                        { name: 'Match Type', value: matchType, inline: true },
                        { name: 'Case Sensitive', value: caseSensitive ? 'Yes' : 'No', inline: true },
                        { name: 'Cooldown', value: `${cooldown} seconds`, inline: true }
                    ]
                })]
            });
        }
        
        else if (subcommand === 'remove') {
            const trigger = interaction.options.getString('trigger');
            const emoji = interaction.options.getString('emoji');
            
            const success = responseManager.removeReact(interaction.guild.id, trigger, emoji);
            
            if (success) {
                return interaction.reply({
                    embeds: [createEmbed({
                        title: 'Auto-Reaction Removed',
                        description: emoji 
                            ? `I'll no longer react with ${emoji} to "${trigger}"`
                            : `I'll no longer react to "${trigger}" with any emoji`,
                        type: 'success'
                    })]
                });
            } else {
                return interaction.reply({
                    embeds: [createEmbed({
                        title: 'Error',
                        description: emoji
                            ? `No auto-reaction found for trigger "${trigger}" with emoji ${emoji}`
                            : `No auto-reactions found for trigger "${trigger}"`,
                        type: 'error'
                    })],
                    ephemeral: true
                });
            }
        }
        
        else if (subcommand === 'list') {
            const reactions = responseManager.listReacts(interaction.guild.id);
            
            if (!reactions.length) {
                return interaction.reply({
                    embeds: [createEmbed({
                        title: 'Auto-Reactions',
                        description: 'No auto-reactions have been set up for this server.',
                        type: 'info'
                    })]
                });
            }
            
            // Group by trigger for more compact display
            const triggerGroups = {};
            reactions.forEach(reaction => {
                if (!triggerGroups[reaction.trigger]) {
                    triggerGroups[reaction.trigger] = [];
                }
                triggerGroups[reaction.trigger].push({
                    emoji: reaction.emoji,
                    enabled: reaction.enabled,
                    matchType: reaction.matchType
                });
            });
            
            // Create fields for each trigger group
            const embedFields = Object.keys(triggerGroups).map((trigger, index) => {
                const emojis = triggerGroups[trigger].map(r => 
                    `${r.emoji}${r.enabled ? '' : ' (Disabled)'}`).join(' ');
                const matchType = triggerGroups[trigger][0].matchType;
                
                return {
                    name: `${index + 1}. ${trigger}`,
                    value: `Emojis: ${emojis}\nMatch: ${matchType}`
                };
            });
            
            return interaction.reply({
                embeds: [createEmbed({
                    title: 'Auto-Reactions',
                    description: `This server has ${reactions.length} auto-reaction${reactions.length === 1 ? '' : 's'} across ${Object.keys(triggerGroups).length} trigger${Object.keys(triggerGroups).length === 1 ? '' : 's'}.`,
                    type: 'info',
                    fields: embedFields.slice(0, 25) // Discord limits to 25 fields
                })]
            });
        }
        
        else if (subcommand === 'info') {
            const trigger = interaction.options.getString('trigger');
            const emoji = interaction.options.getString('emoji');
            const reaction = responseManager.getReactDetails(interaction.guild.id, trigger, emoji);
            
            if (!reaction) {
                return interaction.reply({
                    embeds: [createEmbed({
                        title: 'Error',
                        description: `No auto-reaction found for trigger "${trigger}" with emoji ${emoji}`,
                        type: 'error'
                    })],
                    ephemeral: true
                });
            }
            
            return interaction.reply({
                embeds: [createEmbed({
                    title: `Auto-Reaction Info: ${reaction.trigger} → ${reaction.emoji}`,
                    description: `When I see "${reaction.trigger}", I'll react with ${reaction.emoji}`,
                    type: 'info',
                    fields: [
                        { name: 'Status', value: reaction.enabled ? 'Enabled' : 'Disabled', inline: true },
                        { name: 'Match Type', value: reaction.matchType, inline: true },
                        { name: 'Case Sensitive', value: reaction.caseSensitive ? 'Yes' : 'No', inline: true },
                        { name: 'Cooldown', value: `${reaction.cooldown} seconds`, inline: true },
                        { name: 'Created By', value: `<@${reaction.createdBy}>`, inline: true },
                        { name: 'Created At', value: new Date(reaction.createdAt).toLocaleString(), inline: true },
                        { name: 'Last Triggered', value: reaction.lastTriggered ? new Date(reaction.lastTriggered).toLocaleString() : 'Never', inline: true }
                    ]
                })]
            });
        }
        
        else if (subcommand === 'toggle') {
            const trigger = interaction.options.getString('trigger');
            const emoji = interaction.options.getString('emoji');
            const newState = responseManager.toggleReact(interaction.guild.id, trigger, emoji);
            
            if (newState === false && typeof newState !== 'boolean') {
                return interaction.reply({
                    embeds: [createEmbed({
                        title: 'Error',
                        description: `No auto-reaction found for trigger "${trigger}" with emoji ${emoji}`,
                        type: 'error'
                    })],
                    ephemeral: true
                });
            }
            
            return interaction.reply({
                embeds: [createEmbed({
                    title: 'Auto-Reaction Toggled',
                    description: `Auto-reaction "${trigger}" → ${emoji} is now ${newState ? 'enabled' : 'disabled'}.`,
                    type: 'success'
                })]
            });
        }
    },

    isValidEmoji(emoji, guild) {
        const standardEmojiRegex = /^(\u00a9|\u00ae|[\u2000-\u3300]|\ud83c[\ud000-\udfff]|\ud83d[\ud000-\udfff]|\ud83e[\ud000-\udfff])+$/;
        if (standardEmojiRegex.test(emoji)) {
            return true;
        }

        const customEmojiRegex = /<a?:[a-zA-Z0-9_]+:(\d+)>/;
        const match = emoji.match(customEmojiRegex);
        if (match) {
            const emojiId = match[1];
            return guild.emojis.cache.has(emojiId);
        }

        const idOnlyRegex = /^(\d+)$|^[a-zA-Z0-9_]+:(\d+)$/;
        const idMatch = emoji.match(idOnlyRegex);
        if (idMatch) {
            const emojiId = idMatch[1] || idMatch[2];
            return guild.emojis.cache.has(emojiId);
        }
        
        return false;
    }
};