const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const { createEmbed } = require('../../utils/embedBuilder');
const logger = require('../../utils/logger');

module.exports = {
    name: 'ban',
    description: 'Ban a member from the server',
    usage: '@user [days] [reason]',
    category: 'moderation',
    guildOnly: true,
    permissions: [PermissionFlagsBits.BanMembers],
    
    slashCommand: new SlashCommandBuilder()
        .setName('ban')
        .setDescription('Ban a member from the server')
        .addUserOption(option => 
            option.setName('target')
                .setDescription('The member to ban')
                .setRequired(true))
        .addIntegerOption(option => 
            option.setName('days')
                .setDescription('Number of days of messages to delete (0-7)')
                .setMinValue(0)
                .setMaxValue(7)
                .setRequired(false))
        .addStringOption(option => 
            option.setName('reason')
                .setDescription('Reason for banning')
                .setRequired(false))
        .setDefaultMemberPermissions(PermissionFlagsBits.BanMembers),
    
    async execute(message, args, client) {
        if (!args.length) {
            return message.reply({ 
                embeds: [createEmbed({
                    title: 'Command Error',
                    description: 'You need to specify a user to ban.',
                    type: 'error'
                })]
            });
        }
        
        const target = message.mentions.members.first();
        
        if (!target) {
            return message.reply({ 
                embeds: [createEmbed({
                    title: 'Command Error',
                    description: 'You need to mention a valid member to ban.',
                    type: 'error'
                })]
            });
        }
        
        if (!target.bannable) {
            return message.reply({ 
                embeds: [createEmbed({
                    title: 'Command Error',
                    description: 'I cannot ban this user. They may have a higher role than me or I don\'t have ban permissions.',
                    type: 'error'
                })]
            });
        }

        let days = 0;
        let reasonStartIndex = 1;
        
        if (args.length > 1 && !isNaN(args[1])) {
            days = parseInt(args[1]);

            if (days < 0 || days > 7) {
                return message.reply({ 
                    embeds: [createEmbed({
                        title: 'Command Error',
                        description: 'Days must be between 0 and 7.',
                        type: 'error'
                    })]
                });
            }
            
            reasonStartIndex = 2;
        }
        
        const reason = args.slice(reasonStartIndex).join(' ') || 'No reason provided';
        
        try {
            await target.ban({ 
                deleteMessageDays: days,
                reason: `${message.author.tag}: ${reason}`
            });
            
            logger.info(`${message.author.tag} banned ${target.user.tag} | Reason: ${reason} | Days: ${days}`);

            const banEmbed = createEmbed({
                title: 'Member Banned',
                description: `Successfully banned ${target.user.tag}.`,
                type: 'success',
                fields: [
                    { name: 'Reason', value: reason },
                    { name: 'Message History Deleted', value: `${days} day(s)` }
                ]
            });
            
            message.reply({ embeds: [banEmbed] });

            try {
                await target.user.send({ 
                    embeds: [createEmbed({
                        title: `You've Been Banned from ${message.guild.name}`,
                        description: `You have been banned from ${message.guild.name}.`,
                        type: 'error',
                        fields: [
                            { name: 'Reason', value: reason },
                            { name: 'Banned By', value: message.author.tag }
                        ]
                    })]
                });
            } catch (dmError) {
                logger.warn(`Couldn't send DM to ${target.user.tag}`);
            }
            
        } catch (error) {
            logger.error(`Error banning ${target.user.tag}:`, error);
            
            message.reply({ 
                embeds: [createEmbed({
                    title: 'Command Error',
                    description: `Failed to ban ${target.user.tag}: ${error.message}`,
                    type: 'error'
                })]
            });
        }
    },
    
    async executeSlash(interaction, client) {
        const target = interaction.options.getMember('target');
        const days = interaction.options.getInteger('days') || 0;
        const reason = interaction.options.getString('reason') || 'No reason provided';
        
        if (!target) {
            return interaction.reply({ 
                embeds: [createEmbed({
                    title: 'Command Error',
                    description: 'You need to specify a valid member to ban.',
                    type: 'error'
                })],
                ephemeral: true
            });
        }
        
        if (!target.bannable) {
            return interaction.reply({ 
                embeds: [createEmbed({
                    title: 'Command Error',
                    description: 'I cannot ban this user. They may have a higher role than me or I don\'t have ban permissions.',
                    type: 'error'
                })],
                ephemeral: true
            });
        }
        
        try {
            await target.ban({ 
                deleteMessageDays: days,
                reason: `${interaction.user.tag}: ${reason}`
            });
            
            logger.info(`${interaction.user.tag} banned ${target.user.tag} | Reason: ${reason} | Days: ${days}`);
            
            const banEmbed = createEmbed({
                title: 'Member Banned',
                description: `Successfully banned ${target.user.tag}.`,
                type: 'success',
                fields: [
                    { name: 'Reason', value: reason },
                    { name: 'Message History Deleted', value: `${days} day(s)` }
                ]
            });
            
            interaction.reply({ embeds: [banEmbed] });
            
            // try dming banned user
            try {
                await target.user.send({ 
                    embeds: [createEmbed({
                        title: `You've Been Banned from ${interaction.guild.name}`,
                        description: `You have been banned from ${interaction.guild.name}.`,
                        type: 'error',
                        fields: [
                            { name: 'Reason', value: reason },
                            { name: 'Banned By', value: interaction.user.tag }
                        ]
                    })]
                });
            } catch (dmError) {
                logger.warn(`Couldn't send DM to ${target.user.tag}`);
            }
            
        } catch (error) {
            logger.error(`Error banning ${target.user.tag}:`, error);
            
            interaction.reply({ 
                embeds: [createEmbed({
                    title: 'Command Error',
                    description: `Failed to ban ${target.user.tag}: ${error.message}`,
                    type: 'error'
                })],
                ephemeral: true
            });
        }
    }
};