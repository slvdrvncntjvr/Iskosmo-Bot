const { SlashCommandBuilder } = require('discord.js');
const { createEmbed } = require('../../utils/embedBuilder');
const permissionManager = require('../../utils/permissionManager');
const logger = require('../../utils/logger');

module.exports = {
    name: 'announce',
    description: 'Send an announcement to all servers',
    usage: '<message>',
    category: 'utility',
    
    slashCommand: new SlashCommandBuilder()
        .setName('announce')
        .setDescription('Send an announcement to all servers')
        .addStringOption(option => 
            option.setName('message')
                .setDescription('The announcement message to send')
                .setRequired(true))
        .addStringOption(option => 
            option.setName('title')
                .setDescription('The title for the announcement')
                .setRequired(false)),
    
    async execute(message, args, client) {
        if (!permissionManager.isAuthorized(message.author.id, 'announce')) {
            return message.reply({
                embeds: [createEmbed({
                    title: 'Permission Denied',
                    description: 'You are not authorized to use this command.',
                    type: 'error'
                })]
            });
        }

        if (!args.length) {
            return message.reply({
                embeds: [createEmbed({
                    title: 'Error',
                    description: `You need to provide an announcement message. Usage: \`!${this.name} ${this.usage}\``,
                    type: 'error'
                })]
            });
        }
        
        const announcementText = args.join(' ');

        const result = await this.sendAnnouncement(client, {
            title: 'Announcement',
            description: announcementText
        });

        message.reply({
            embeds: [createEmbed({
                title: 'Announcement Sent',
                description: `Announcement has been sent to ${result.success} servers. Failed: ${result.failed}`,
                type: 'success'
            })]
        });
    },
    
    async executeSlash(interaction, client) {
        if (!permissionManager.isAuthorized(interaction.user.id, 'announce')) {
            return interaction.reply({
                embeds: [createEmbed({
                    title: 'Permission Denied',
                    description: 'You are not authorized to use this command.',
                    type: 'error'
                })],
                ephemeral: true
            });
        }
        
        await interaction.deferReply();
        
        const announcementText = interaction.options.getString('message');
        const title = interaction.options.getString('title') || 'Announcement';

        const result = await this.sendAnnouncement(client, {
            title,
            description: announcementText
        });

        interaction.editReply({
            embeds: [createEmbed({
                title: 'Announcement Sent',
                description: `Announcement has been sent to ${result.success} servers. Failed: ${result.failed}`,
                type: 'success'
            })]
        });
    },

    async sendAnnouncement(client, { title, description }) {
        let successCount = 0;
        let failedCount = 0;

        const announcementEmbed = createEmbed({
            title,
            description,
            type: 'info'
        });

        const guilds = client.guilds.cache.values();
        
        for (const guild of guilds) {
            try {
                let targetChannel = guild.systemChannel;

                if (!targetChannel) {
                    const channels = guild.channels.cache
                        .filter(channel => channel.type === 0) 
                        .filter(channel => channel.permissionsFor(guild.members.me).has('SendMessages'));
                    
                    if (channels.size > 0) {
                        targetChannel = channels.first();
                    }
                }

                if (targetChannel) {
                    await targetChannel.send({ embeds: [announcementEmbed] });
                    successCount++;
                    logger.info(`Sent announcement to ${guild.name} (${guild.id})`);
                } else {
                    failedCount++;
                    logger.warn(`Could not find suitable channel in ${guild.name} (${guild.id})`);
                }
            } catch (error) {
                failedCount++;
                logger.error(`Failed to send announcement to ${guild.name} (${guild.id}):`, error);
            }
        }
        
        logger.info(`Announcement sent to ${successCount} servers. Failed: ${failedCount}`);
        return { success: successCount, failed: failedCount };
    }
};