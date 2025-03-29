const { SlashCommandBuilder, PermissionFlagsBits, ActivityType } = require('discord.js');
const { createEmbed } = require('../../utils/embedBuilder');
const logger = require('../../utils/logger');

module.exports = {
    name: 'statusset',
    description: 'Set a temporary custom status for the bot',
    usage: '<text> [time_in_seconds]',
    category: 'utility',
    permissions: [PermissionFlagsBits.ManageGuild],
    requiresAuth: true,
    
    slashCommand: new SlashCommandBuilder()
        .setName('statusset')
        .setDescription('Set a temporary custom status for the bot')
        .addStringOption(option => 
            option.setName('text')
                .setDescription('The status text to display')
                .setRequired(true))
        .addIntegerOption(option => 
            option.setName('duration')
                .setDescription('Duration in seconds (default: 30)')
                .setRequired(false)
                .setMinValue(5)
                .setMaxValue(3600))
        .addStringOption(option => 
            option.setName('type')
                .setDescription('The type of status activity')
                .setRequired(false)
                .addChoices(
                    { name: 'Playing', value: 'PLAYING' },
                    { name: 'Watching', value: 'WATCHING' },
                    { name: 'Listening', value: 'LISTENING' },
                    { name: 'Competing', value: 'COMPETING' }
                ))
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),
    
    async execute(message, args, client) {
        if (!args.length) {
            return message.reply({
                embeds: [createEmbed({
                    title: 'Error',
                    description: `You need to provide a status text. Usage: \`!${this.name} ${this.usage}\``,
                    type: 'error'
                })]
            });
        }

        let duration = 30; 
        let statusText = '';

        if (/^\d+$/.test(args[args.length - 1])) {
            duration = parseInt(args.pop());
            statusText = args.join(' ');
        } else {
            statusText = args.join(' ');
        }

        if (duration < 5) duration = 5;
        if (duration > 3600) duration = 3600; // Max 1 hour

        await this.setTemporaryStatus(client, statusText, duration, ActivityType.Playing);

        message.reply({
            embeds: [createEmbed({
                title: 'Status Updated',
                description: `The bot status has been temporarily set to **"${statusText}"** for ${duration} seconds.`,
                type: 'success'
            })]
        });
    },
    
    async executeSlash(interaction, client) {
        const statusText = interaction.options.getString('text');
        const duration = interaction.options.getInteger('duration') || 30;
        const activityTypeString = interaction.options.getString('type') || 'PLAYING';

        const activityTypeMap = {
            'PLAYING': ActivityType.Playing,
            'WATCHING': ActivityType.Watching,
            'LISTENING': ActivityType.Listening,
            'COMPETING': ActivityType.Competing
        };
        
        const activityType = activityTypeMap[activityTypeString];
        await this.setTemporaryStatus(client, statusText, duration, activityType);

        interaction.reply({
            embeds: [createEmbed({
                title: 'Status Updated',
                description: `The bot status has been temporarily set to **"${activityTypeString} ${statusText}"** for ${duration} seconds.`,
                type: 'success'
            })]
        });
    },

    async setTemporaryStatus(client, statusText, duration, activityType) {
        if (client.statusManager) {
            client.statusManager.setTemporaryStatus(statusText, duration, activityType);
        } else {
            client.user.setPresence({
                activities: [{
                    name: statusText,
                    type: activityType
                }],
                status: 'online'
            });
            
            logger.info(`Temporary status set: "${ActivityType[activityType]} ${statusText}" for ${duration} seconds`);

            if (client.statusTimeout) {
                clearTimeout(client.statusTimeout);
            }

            client.statusTimeout = setTimeout(() => {
                const guildCount = client.guilds.cache.size;
                client.user.setPresence({
                    activities: [{
                        name: `in ${guildCount} guilds`,
                        type: ActivityType.Playing
                    }],
                    status: 'online'
                });
                logger.info('Default status restored after temporary status');
            }, duration * 1000);
        }
    }
};