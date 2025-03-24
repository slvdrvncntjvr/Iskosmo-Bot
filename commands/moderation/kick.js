const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const { createEmbed } = require('../../utils/embedBuilder');

module.exports = {
    name: 'kick',
    description: 'Kick a member from the server',
    usage: '@user [reason]',
    category: 'moderation',
    guildOnly: true,
    permissions: [PermissionFlagsBits.KickMembers],
    
    // Slash command definition
    slashCommand: new SlashCommandBuilder()
        .setName('kick')
        .setDescription('Kick a member from the server')
        .addUserOption(option => 
            option.setName('target')
                .setDescription('The member to kick')
                .setRequired(true))
        .addStringOption(option => 
            option.setName('reason')
                .setDescription('Reason for kicking')
                .setRequired(false))
        .setDefaultMemberPermissions(PermissionFlagsBits.KickMembers),
    
    async execute(message, args, client) {
        if (!args.length) {
            return message.reply({ 
                embeds: [createEmbed({
                    title: 'Command Error',
                    description: 'You need to specify a user to kick.',
                    type: 'error'
                })]
            });
        }
        
        const target = message.mentions.members.first();
        
        if (!target) {
            return message.reply({ 
                embeds: [createEmbed({
                    title: 'Command Error',
                    description: 'You need to mention a valid member to kick.',
                    type: 'error'
                })]
            });
        }
        
        if (!target.kickable) {
            return message.reply({ 
                embeds: [createEmbed({
                    title: 'Command Error',
                    description: 'I cannot kick this user. They may have a higher role than me or I don\'t have kick permissions.',
                    type: 'error'
                })]
            });
        }
        
        const reason = args.slice(1).join(' ') || 'No reason provided';
        
        try {
            await target.kick(reason);
            
            message.reply({ 
                embeds: [createEmbed({
                    title: 'Member Kicked',
                    description: `Successfully kicked ${target.user.tag}.\nReason: ${reason}`,
                    type: 'success'
                })]
            });
        } catch (error) {
            message.reply({ 
                embeds: [createEmbed({
                    title: 'Command Error',
                    description: `Failed to kick ${target.user.tag}: ${error.message}`,
                    type: 'error'
                })]
            });
        }
    },
    
    async executeSlash(interaction, client) {
        const target = interaction.options.getMember('target');
        const reason = interaction.options.getString('reason') || 'No reason provided';
        
        if (!target) {
            return interaction.reply({ 
                embeds: [createEmbed({
                    title: 'Command Error',
                    description: 'You need to specify a valid member to kick.',
                    type: 'error'
                })],
                ephemeral: true
            });
        }
        
        if (!target.kickable) {
            return interaction.reply({ 
                embeds: [createEmbed({
                    title: 'Command Error',
                    description: 'I cannot kick this user. They may have a higher role than me or I don\'t have kick permissions.',
                    type: 'error'
                })],
                ephemeral: true
            });
        }
        
        try {
            await target.kick(reason);
            
            interaction.reply({ 
                embeds: [createEmbed({
                    title: 'Member Kicked',
                    description: `Successfully kicked ${target.user.tag}.\nReason: ${reason}`,
                    type: 'success'
                })]
            });
        } catch (error) {
            interaction.reply({ 
                embeds: [createEmbed({
                    title: 'Command Error',
                    description: `Failed to kick ${target.user.tag}: ${error.message}`,
                    type: 'error'
                })],
                ephemeral: true
            });
        }
    }
};