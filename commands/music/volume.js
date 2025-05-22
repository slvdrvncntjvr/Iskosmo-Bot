const { SlashCommandBuilder } = require('discord.js');
const { createEmbed } = require('../../utils/embedBuilder');
const logger = require('../../utils/logger');
const musicPlayer = require('../../utils/musicPlayer');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('volume')
        .setDescription('Sets the playback volume (0-200%).')
        .addIntegerOption(option =>
            option.setName('level')
                .setDescription('Volume level (0-200)')
                .setRequired(true)
                .setMinValue(0)
                .setMaxValue(200)),
    name: 'volume',
    description: 'Sets the playback volume (0-200%).',
    aliases: ['vol'],
    args: true,
    usage: '<volume level (0-200)>',
    guildOnly: true,
    async executeSlash(interaction) {
        const { guild, member } = interaction;
        const voiceChannel = member.voice.channel;

        if (!voiceChannel) {
            const errorEmbed = createEmbed('Error', 'You need to be in a voice channel to use this command.');
            return interaction.reply({ embeds: [errorEmbed], ephemeral: true });
        }

        const playerInstance = musicPlayer.getGuildPlayer(guild.id);
        if (!playerInstance || !playerInstance.isPlaying || !playerInstance.currentSong) {
            const errorEmbed = createEmbed('Not Playing', 'Nothing is currently playing in this server.');
            return interaction.reply({ embeds: [errorEmbed], ephemeral: true });
        }

        // Optional: Check if user is in the same voice channel as the bot
        if (playerInstance.connection && playerInstance.connection.joinConfig.channelId !== voiceChannel.id) {
            const errorEmbed = createEmbed('Error', 'You must be in the same voice channel as the bot to change the volume.');
            return interaction.reply({ embeds: [errorEmbed], ephemeral: true });
        }

        const volumeLevel = interaction.options.getInteger('level');

        try {
            const result = musicPlayer.setVolume(guild.id, volumeLevel);
            if (result.success) {
                const successEmbed = createEmbed('Volume Set', `🔊 Volume set to **${result.volume}%**.`);
                await interaction.reply({ embeds: [successEmbed] });
            } else {
                const errorEmbed = createEmbed('Error', result.reason || 'Could not set volume.');
                await interaction.reply({ embeds: [errorEmbed], ephemeral: true });
            }
        } catch (error) {
            logger.error(`[VolumeCommand ${guild.id}] Error executing volume command (slash): ${error.message}`, error);
            const errorEmbed = createEmbed('Error', `An error occurred: ${error.message}`);
            if (interaction.replied || interaction.deferred) {
                await interaction.editReply({ embeds: [errorEmbed] });
            } else {
                await interaction.reply({ embeds: [errorEmbed], ephemeral: true });
            }
        }
    },
    async execute(message, args) {
        const { guild, member } = message;
        const voiceChannel = member.voice.channel;

        if (!voiceChannel) {
            const errorEmbed = createEmbed('Error', 'You need to be in a voice channel to use this command.');
            return message.reply({ embeds: [errorEmbed] });
        }

        const playerInstance = musicPlayer.getGuildPlayer(guild.id);
        if (!playerInstance || !playerInstance.isPlaying || !playerInstance.currentSong) {
            const errorEmbed = createEmbed('Not Playing', 'Nothing is currently playing in this server.');
            return message.reply({ embeds: [errorEmbed] });
        }

        if (playerInstance.connection && playerInstance.connection.joinConfig.channelId !== voiceChannel.id) {
            const errorEmbed = createEmbed('Error', 'You must be in the same voice channel as the bot to change the volume.');
            return message.reply({ embeds: [errorEmbed] });
        }

        if (args.length === 0) {
            const usageEmbed = createEmbed('Usage', `Correct usage: \`${message.client.prefix}${this.name} ${this.usage}\``);
            return message.reply({ embeds: [usageEmbed] });
        }

        const volumeLevel = parseInt(args[0]);
        if (isNaN(volumeLevel) || volumeLevel < 0 || volumeLevel > 200) {
            const errorEmbed = createEmbed('Invalid Volume', 'Please provide a volume level between 0 and 200.');
            return message.reply({ embeds: [errorEmbed] });
        }

        try {
            const result = musicPlayer.setVolume(guild.id, volumeLevel);
            if (result.success) {
                const successEmbed = createEmbed('Volume Set', `🔊 Volume set to **${result.volume}%**.`);
                await message.reply({ embeds: [successEmbed] });
            } else {
                const errorEmbed = createEmbed('Error', result.reason || 'Could not set volume.');
                await message.reply({ embeds: [errorEmbed] });
            }
        } catch (error) {
            logger.error(`[VolumeCommand ${guild.id}] Error executing volume command (prefix): ${error.message}`, error);
            const errorEmbed = createEmbed('Error', `An error occurred: ${error.message}`);
            await message.reply({ embeds: [errorEmbed] });
        }
    },
};
