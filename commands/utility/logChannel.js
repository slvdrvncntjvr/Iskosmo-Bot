const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const { createEmbed } = require('../../utils/embedBuilder');
const fs = require('fs');
const path = require('path');

const LOG_SETTINGS_PATH = path.join(__dirname, '../../data/logSettings.json');


if (!fs.existsSync(path.join(__dirname, '../../data'))) {
    fs.mkdirSync(path.join(__dirname, '../../data'), { recursive: true });
}

let logSettings = {};
try {
    if (fs.existsSync(LOG_SETTINGS_PATH)) {
        logSettings = JSON.parse(fs.readFileSync(LOG_SETTINGS_PATH, 'utf8'));
    } else {
        fs.writeFileSync(LOG_SETTINGS_PATH, JSON.stringify(logSettings), 'utf8');
    }
} catch (error) {
    console.error('Failed to load log settings:', error);
}

function saveSettings() {
    try {
        fs.writeFileSync(LOG_SETTINGS_PATH, JSON.stringify(logSettings, null, 2), 'utf8');
    } catch (error) {
        console.error('Failed to save log settings:', error);
    }
}

module.exports = {
    name: 'logchannel',
    description: 'Set or view the channel for bot logs',
    usage: '[set #channel | disable]',
    category: 'utility',
    guildOnly: true,
    permissions: [PermissionFlagsBits.ManageGuild],

    slashCommand: new SlashCommandBuilder()
        .setName('logchannel')
        .setDescription('Set or view the channel for bot logs')
        .addSubcommand(subcommand =>
            subcommand
                .setName('set')
                .setDescription('Set the channel for bot logs')
                .addChannelOption(option =>
                    option.setName('channel')
                        .setDescription('The channel to send logs to')
                        .setRequired(true)))
        .addSubcommand(subcommand =>
            subcommand
                .setName('view')
                .setDescription('View the current log channel'))
        .addSubcommand(subcommand =>
            subcommand
                .setName('disable')
                .setDescription('Disable logging to a channel'))
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),
    
    async execute(message, args, client) {
        const guildId = message.guild.id;

        if (!args.length || args[0].toLowerCase() === 'view') {
            return this.viewLogChannel(message, guildId);
        }
        
        if (args[0].toLowerCase() === 'disable') {
            return this.disableLogChannel(message, guildId);
        }
        
        if (args[0].toLowerCase() === 'set') {
            const channel = message.mentions.channels.first();
            if (!channel) {
                return message.reply({
                    embeds: [createEmbed({
                        title: 'Error',
                        description: 'Please mention a channel to set as the log channel.',
                        type: 'error'
                    })]
                });
            }
            
            return this.setLogChannel(message, guildId, channel);
        }
        
        // Invalid usage
        return message.reply({
            embeds: [createEmbed({
                title: 'Error',
                description: `Invalid usage. Try \`!${this.name} ${this.usage}\``,
                type: 'error'
            })]
        });
    },
    
    async executeSlash(interaction, client) {
        const guildId = interaction.guild.id;
        const subcommand = interaction.options.getSubcommand();
        
        if (subcommand === 'view') {
            return this.viewLogChannel(interaction, guildId);
        }
        
        if (subcommand === 'disable') {
            return this.disableLogChannel(interaction, guildId);
        }
        
        if (subcommand === 'set') {
            const channel = interaction.options.getChannel('channel');
            return this.setLogChannel(interaction, guildId, channel);
        }
    },

    async viewLogChannel(interaction, guildId) {
        const logChannelId = logSettings[guildId];
        
        if (!logChannelId) {
            return this.reply(interaction, {
                title: 'Log Channel',
                description: 'No log channel has been set for this server.',
                type: 'info'
            });
        }
        
        const guild = interaction.guild;
        const channel = guild.channels.cache.get(logChannelId);
        
        if (!channel) {
            // Channel no longer exists, remove from settings
            delete logSettings[guildId];
            saveSettings();
            
            return this.reply(interaction, {
                title: 'Log Channel',
                description: 'The previously set log channel no longer exists. Logging has been disabled.',
                type: 'warning'
            });
        }
        
        return this.reply(interaction, {
            title: 'Log Channel',
            description: `Logs are currently being sent to ${channel}.`,
            type: 'info'
        });
    },
    
    async disableLogChannel(interaction, guildId) {
        if (!logSettings[guildId]) {
            return this.reply(interaction, {
                title: 'Log Channel',
                description: 'Logging was not enabled for this server.',
                type: 'info'
            });
        }
        
        delete logSettings[guildId];
        saveSettings();
        
        return this.reply(interaction, {
            title: 'Log Channel',
            description: 'Logging has been disabled for this server.',
            type: 'success'
        });
    },
    
    async setLogChannel(interaction, guildId, channel) {
        if (channel.type !== 0) { 
            return this.reply(interaction, {
                title: 'Error',
                description: 'The log channel must be a text channel.',
                type: 'error'
            });
        }

        const permissions = channel.permissionsFor(interaction.guild.members.me);
        if (!permissions.has(PermissionFlagsBits.SendMessages) || !permissions.has(PermissionFlagsBits.ViewChannel)) {
            return this.reply(interaction, {
                title: 'Error',
                description: 'I don\'t have permission to send messages in that channel. Please give me the required permissions and try again.',
                type: 'error'
            });
        }

        logSettings[guildId] = channel.id;
        saveSettings();

        try {
            await channel.send({
                embeds: [createEmbed({
                    title: 'Log Channel Set',
                    description: 'This channel has been set as the log channel for the bot. All command usage and events will be logged here.',
                    type: 'info'
                })]
            });
            
            return this.reply(interaction, {
                title: 'Log Channel',
                description: `Successfully set ${channel} as the log channel.`,
                type: 'success'
            });
        } catch (error) {
            return this.reply(interaction, {
                title: 'Error',
                description: `Failed to send a test message to the channel: ${error.message}`,
                type: 'error'
            });
        }
    },

    async reply(interaction, embedOptions) {
        const embed = createEmbed(embedOptions);
        
        if (interaction.reply) {
            if (interaction.deferred) {
                return interaction.editReply({ embeds: [embed] });
            } else {
                return interaction.reply({ embeds: [embed] });
            }
        } else {
            return interaction.reply({ embeds: [embed] });
        }
    }
};