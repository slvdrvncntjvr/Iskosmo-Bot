// commands/utility/autorespond.js
const { SlashCommandBuilder } = require('discord.js');
const { createEmbed } = require('../../utils/embedBuilder');
const responseManager = require('../../utils/responseManager');
const logger = require('../../utils/logger');

module.exports = {
    name: 'autorespond',
    description: 'Create, list, or remove automatic responses to specific triggers',
    usage: '<add/remove/list/info/toggle> [trigger] [response] [options]',
    category: 'utility',
    requiresAuth: true, // Only authorized users can manage auto-responses
    
    slashCommand: new SlashCommandBuilder()
        .setName('autorespond')
        .setDescription('Manage automatic responses to specific triggers')
        .addSubcommand(subcommand =>
            subcommand
                .setName('add')
                .setDescription('Add a new auto-response')
                .addStringOption(option => 
                    option.setName('trigger')
                        .setDescription('Word or phrase that triggers the response')
                        .setRequired(true))
                .addStringOption(option => 
                    option.setName('response')
                        .setDescription('Response to send when triggered')
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
                .setDescription('Remove an auto-response')
                .addStringOption(option => 
                    option.setName('trigger')
                        .setDescription('Trigger word/phrase to remove')
                        .setRequired(true)))
        .addSubcommand(subcommand =>
            subcommand
                .setName('list')
                .setDescription('List all auto-responses for this server'))
        .addSubcommand(subcommand =>
            subcommand
                .setName('info')
                .setDescription('Get detailed info about a specific auto-response')
                .addStringOption(option => 
                    option.setName('trigger')
                        .setDescription('Trigger word/phrase to get info about')
                        .setRequired(true)))
        .addSubcommand(subcommand =>
            subcommand
                .setName('toggle')
                .setDescription('Enable or disable an auto-response')
                .addStringOption(option => 
                    option.setName('trigger')
                        .setDescription('Trigger word/phrase to toggle')
                        .setRequired(true))),
    
    async execute(message, args, client) {
        if (!args.length) {
            return message.reply({
                embeds: [createEmbed({
                    title: 'Auto-Response Help',
                    description: `Usage: \`!${this.name} ${this.usage}\``,
                    type: 'info',
                    fields: [
                        { name: 'Add', value: '`!autorespond add <trigger> <response> [match_type] [case_sensitive] [cooldown]`' },
                        { name: 'Remove', value: '`!autorespond remove <trigger>`' },
                        { name: 'List', value: '`!autorespond list`' },
                        { name: 'Info', value: '`!autorespond info <trigger>`' },
                        { name: 'Toggle', value: '`!autorespond toggle <trigger>`' },
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
                        description: 'You need to provide both a trigger and a response.',
                        type: 'error'
                    })]
                });
            }
            
            const trigger = args[1];

            let responseText = '';
            let options = {};
            let optionStartIndex = -1;
            for (let i = 2; i < args.length; i++) {
                if (args[i].startsWith('--')) {
                    optionStartIndex = i;
                    break;
                }
            }

            if (optionStartIndex === -1) {
                responseText = args.slice(2).join(' ');
            } else {
                responseText = args.slice(2, optionStartIndex).join(' ');
            }

            if (optionStartIndex !== -1) {
                for (let i = optionStartIndex; i < args.length; i++) {
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
            }
            
            options.createdBy = message.author.id;
            
            const result = responseManager.addResponse(
                message.guild.id,
                trigger,
                responseText,
                options
            );
            
            return message.reply({
                embeds: [createEmbed({
                    title: result === 'added' ? 'Auto-Response Added' : 'Auto-Response Updated',
                    description: `I'll now respond with "${responseText}" when I see "${trigger}"`,
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
            const success = responseManager.removeResponse(message.guild.id, trigger);
            
            if (success) {
                return message.reply({
                    embeds: [createEmbed({
                        title: 'Auto-Response Removed',
                        description: `I'll no longer respond to "${trigger}"`,
                        type: 'success'
                    })]
                });
            } else {
                return message.reply({
                    embeds: [createEmbed({
                        title: 'Error',
                        description: `No auto-response found for trigger "${trigger}"`,
                        type: 'error'
                    })]
                });
            }
        }
        
        else if (subcommand === 'list') {
            const responses = responseManager.listResponses(message.guild.id);
            
            if (!responses.length) {
                return message.reply({
                    embeds: [createEmbed({
                        title: 'Auto-Responses',
                        description: 'No auto-responses have been set up for this server.',
                        type: 'info'
                    })]
                });
            }
            
            // Group responses into pages of 10
            const pages = [];
            for (let i = 0; i < responses.length; i += 10) {
                pages.push(responses.slice(i, i + 10));
            }
            
            const embedFields = pages[0].map((response, index) => ({
                name: `${index + 1}. ${response.trigger} ${response.enabled ? '' : '(Disabled)'}`,
                value: `Response: ${response.response.length > 100 ? response.response.substring(0, 97) + '...' : response.response}\nMatch: ${response.matchType}, Case: ${response.caseSensitive ? 'Sensitive' : 'Insensitive'}`
            }));
            
            return message.reply({
                embeds: [createEmbed({
                    title: 'Auto-Responses',
                    description: `This server has ${responses.length} auto-response${responses.length === 1 ? '' : 's'}.${pages.length > 1 ? ' Showing page 1 of ' + pages.length + '.' : ''}`,
                    type: 'info',
                    fields: embedFields
                })]
            });
        }
        
        else if (subcommand === 'info') {
            if (args.length < 2) {
                return message.reply({
                    embeds: [createEmbed({
                        title: 'Error',
                        description: 'You need to provide a trigger to get info about.',
                        type: 'error'
                    })]
                });
            }
            
            const trigger = args[1];
            const response = responseManager.getResponseDetails(message.guild.id, trigger);
            
            if (!response) {
                return message.reply({
                    embeds: [createEmbed({
                        title: 'Error',
                        description: `No auto-response found for trigger "${trigger}"`,
                        type: 'error'
                    })]
                });
            }
            
            return message.reply({
                embeds: [createEmbed({
                    title: `Auto-Response Info: ${response.trigger}`,
                    description: `Response: ${response.response}`,
                    type: 'info',
                    fields: [
                        { name: 'Status', value: response.enabled ? 'Enabled' : 'Disabled', inline: true },
                        { name: 'Match Type', value: response.matchType, inline: true },
                        { name: 'Case Sensitive', value: response.caseSensitive ? 'Yes' : 'No', inline: true },
                        { name: 'Cooldown', value: `${response.cooldown} seconds`, inline: true },
                        { name: 'Created By', value: `<@${response.createdBy}>`, inline: true },
                        { name: 'Created At', value: new Date(response.createdAt).toLocaleString(), inline: true },
                        { name: 'Last Triggered', value: response.lastTriggered ? new Date(response.lastTriggered).toLocaleString() : 'Never', inline: true }
                    ]
                })]
            });
        }
        
        else if (subcommand === 'toggle') {
            if (args.length < 2) {
                return message.reply({
                    embeds: [createEmbed({
                        title: 'Error',
                        description: 'You need to provide a trigger to toggle.',
                        type: 'error'
                    })]
                });
            }
            
            const trigger = args[1];
            const newState = responseManager.toggleResponse(message.guild.id, trigger);
            
            if (newState === false && typeof newState !== 'boolean') {
                return message.reply({
                    embeds: [createEmbed({
                        title: 'Error',
                        description: `No auto-response found for trigger "${trigger}"`,
                        type: 'error'
                    })]
                });
            }
            
            return message.reply({
                embeds: [createEmbed({
                    title: 'Auto-Response Toggled',
                    description: `Auto-response for "${trigger}" is now ${newState ? 'enabled' : 'disabled'}.`,
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
            const response = interaction.options.getString('response');
            const matchType = interaction.options.getString('match_type') || 'contains';
            const caseSensitive = interaction.options.getBoolean('case_sensitive') || false;
            const cooldown = interaction.options.getInteger('cooldown') || 0;
            
            const options = {
                matchType,
                caseSensitive,
                cooldown,
                createdBy: interaction.user.id
            };
            
            const result = responseManager.addResponse(
                interaction.guild.id,
                trigger,
                response, 
                options
            );
            
            return interaction.reply({
                embeds: [createEmbed({
                    title: result === 'added' ? 'Auto-Response Added' : 'Auto-Response Updated',
                    description: `I'll now respond with "${response}" when I see "${trigger}"`,
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
            const success = responseManager.removeResponse(interaction.guild.id, trigger);
            
            if (success) {
                return interaction.reply({
                    embeds: [createEmbed({
                        title: 'Auto-Response Removed',
                        description: `I'll no longer respond to "${trigger}"`,
                        type: 'success'
                    })]
                });
            } else {
                return interaction.reply({
                    embeds: [createEmbed({
                        title: 'Error',
                        description: `No auto-response found for trigger "${trigger}"`,
                        type: 'error'
                    })]
                });
            }
        }
        
        else if (subcommand === 'list') {
            const responses = responseManager.listResponses(interaction.guild.id);
            
            if (!responses.length) {
                return interaction.reply({
                    embeds: [createEmbed({
                        title: 'Auto-Responses',
                        description: 'No auto-responses have been set up for this server.',
                        type: 'info'
                    })]
                });
            }
            
            // Group responses into pages of 10
            const pages = [];
            for (let i = 0; i < responses.length; i += 10) {
                pages.push(responses.slice(i, i + 10));
            }
            
            const embedFields = pages[0].map((response, index) => ({
                name: `${index + 1}. ${response.trigger} ${response.enabled ? '' : '(Disabled)'}`,
                value: `Response: ${response.response.length > 100 ? response.response.substring(0, 97) + '...' : response.response}\nMatch: ${response.matchType}, Case: ${response.caseSensitive ? 'Sensitive' : 'Insensitive'}`
            }));
            
            return interaction.reply({
                embeds: [createEmbed({
                    title: 'Auto-Responses',
                    description: `This server has ${responses.length} auto-response${responses.length === 1 ? '' : 's'}.${pages.length > 1 ? ' Showing page 1 of ' + pages.length + '.' : ''}`,
                    type: 'info',
                    fields: embedFields
                })]
            });
        }
        
        else if (subcommand === 'info') {
            const trigger = interaction.options.getString('trigger');
            const response = responseManager.getResponseDetails(interaction.guild.id, trigger);
            
            if (!response) {
                return interaction.reply({
                    embeds: [createEmbed({
                        title: 'Error',
                        description: `No auto-response found for trigger "${trigger}"`,
                        type: 'error'
                    })]
                });
            }
            
            return interaction.reply({
                embeds: [createEmbed({
                    title: `Auto-Response Info: ${response.trigger}`,
                    description: `Response: ${response.response}`,
                    type: 'info',
                    fields: [
                        { name: 'Status', value: response.enabled ? 'Enabled' : 'Disabled', inline: true },
                        { name: 'Match Type', value: response.matchType, inline: true },
                        { name: 'Case Sensitive', value: response.caseSensitive ? 'Yes' : 'No', inline: true },
                        { name: 'Cooldown', value: `${response.cooldown} seconds`, inline: true },
                        { name: 'Created By', value: `<@${response.createdBy}>`, inline: true },
                        { name: 'Created At', value: new Date(response.createdAt).toLocaleString(), inline: true },
                        { name: 'Last Triggered', value: response.lastTriggered ? new Date(response.lastTriggered).toLocaleString() : 'Never', inline: true }
                    ]
                })]
            });
        }
        
        else if (subcommand === 'toggle') {
            const trigger = interaction.options.getString('trigger');
            const newState = responseManager.toggleResponse(interaction.guild.id, trigger);
            
            if (newState === false && typeof newState !== 'boolean') {
                return interaction.reply({
                    embeds: [createEmbed({
                        title: 'Error',
                        description: `No auto-response found for trigger "${trigger}"`,
                        type: 'error'
                    })]
                });
            }
            
            return interaction.reply({
                embeds: [createEmbed({
                    title: 'Auto-Response Toggled',
                    description: `Auto-response for "${trigger}" is now ${newState ? 'enabled' : 'disabled'}.`,
                    type: 'success'
                })]
            });
        }
    }
};