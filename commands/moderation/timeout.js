const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const { createEmbed } = require('../../utils/embedBuilder');
const logger = require('../../utils/logger');
const ms = require('ms'); // You may need to install this with npm install ms

module.exports = {
    name: 'timeout',
    description: 'Timeout (mute) a member in the server',
    usage: '@user [duration] [reason]',
    category: 'moderation',
    guildOnly: true,
    permissions: [PermissionFlagsBits.ModerateMembers],
    
    slashCommand: new SlashCommandBuilder()
        .setName('timeout')
        .setDescription('Timeout (mute) a member in the server')
        .addUserOption(option => 
            option.setName('target')
                .setDescription('The member to timeout')
                .setRequired(true))
        .addStringOption(option => 
            option.setName('duration')
                .setDescription('Duration of timeout (e.g. 10m, 1h, 1d)')
                .setRequired(true))
        .addStringOption(option => 
            option.setName('reason')
                .setDescription('Reason for timeout')
                .setRequired(false))
        .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers),
    
    async execute(message, args, client) {
        if (!args.length) {
            return message.reply({ 
                embeds: [createEmbed({
                    title: 'Command Error',
                    description: 'You need to specify a user to timeout.',
                    type: 'error'
                })]
            });
        }
        
        const target = message.mentions.members.first();
        
        if (!target) {
            return message.reply({ 
                embeds: [createEmbed({
                    title: 'Command Error',
                    description: 'You need to mention a valid member to timeout.',
                    type: 'error'
                })]
            });
        }
        
        if (!target.moderatable) {
            return message.reply({ 
                embeds: [createEmbed({
                    title: 'Command Error',
                    description: 'I cannot timeout this user. They may have a higher role than me or I don\'t have timeout permissions.',
                    type: 'error'
                })]
            });
        }

        let durationArg = args[1];
        if (!durationArg) {
            return message.reply({
                embeds: [createEmbed({
                    title: 'Command Error',
                    description: 'You need to specify a timeout duration (e.g. 10m, 1h, 1d).',
                    type: 'error'
                })]
            });
        }

        let duration;
        try {
            duration = ms(durationArg);
            if (!duration || duration < 1000 || duration > 2419200000) { // Between 1 second and 28 days
                throw new Error('Invalid duration');
            }
        } catch (error) {
            return message.reply({
                embeds: [createEmbed({
                    title: 'Command Error',
                    description: 'Invalid duration format. Use formats like 10m, 1h, 1d.',
                    type: 'error'
                })]
            });
        }

        const reasonArray = args.slice(2);
        const reason = reasonArray.length > 0 ? reasonArray.join(' ') : 'No reason provided';
        
        try {
            await target.timeout(duration, `${message.author.tag}: ${reason}`);
            
            const timeoutEmbed = createEmbed({
                title: 'Member Timed Out',
                description: `${target.user.tag} has been timed out.`,
                type: 'success',
                fields: [
                    { name: 'User', value: `${target.user.tag} (${target.id})` },
                    { name: 'Moderator', value: message.author.tag },
                    { name: 'Duration', value: durationArg },
                    { name: 'Reason', value: reason }
                ]
            });
            
            message.reply({ embeds: [timeoutEmbed] });

            try {
                await target.user.send({ 
                    embeds: [createEmbed({
                        title: `You've Been Timed Out in ${message.guild.name}`,
                        description: `You have been timed out in ${message.guild.name}.`,
                        type: 'error',
                        fields: [
                            { name: 'Duration', value: durationArg },
                            { name: 'Reason', value: reason },
                            { name: 'Timed Out By', value: message.author.tag }
                        ]
                    })]
                });
            } catch (dmError) {
                logger.warn(`Couldn't send DM to ${target.user.tag}`);
            }
            
        } catch (error) {
            logger.error(`Error timing out ${target.user.tag}:`, error);
            
            message.reply({ 
                embeds: [createEmbed({
                    title: 'Command Error',
                    description: `Failed to timeout ${target.user.tag}: ${error.message}`,
                    type: 'error'
                })]
            });
        }
    },
    
    async executeSlash(interaction, client) {
        const target = interaction.options.getMember('target');
        const durationString = interaction.options.getString('duration');
        const reason = interaction.options.getString('reason') || 'No reason provided';
        
        if (!target) {
            return interaction.reply({ 
                embeds: [createEmbed({
                    title: 'Command Error',
                    description: 'You need to specify a valid member to timeout.',
                    type: 'error'
                })],
                ephemeral: true
            });
        }
        
        if (!target.moderatable) {
            return interaction.reply({ 
                embeds: [createEmbed({
                    title: 'Command Error',
                    description: 'I cannot timeout this user. They may have a higher role than me or I don\'t have timeout permissions.',
                    type: 'error'
                })],
                ephemeral: true
            });
        }

        let duration;
        try {
            duration = ms(durationString);
            if (!duration || duration < 1000 || duration > 2419200000) { // Between 1 second and 28 days
                throw new Error('Invalid duration');
            }
        } catch (error) {
            return interaction.reply({
                embeds: [createEmbed({
                    title: 'Command Error',
                    description: 'Invalid duration format. Use formats like 10m, 1h, 1d.',
                    type: 'error'
                })],
                ephemeral: true
            });
        }
        
        try {
            await target.timeout(duration, `${interaction.user.tag}: ${reason}`);
            
            const timeoutEmbed = createEmbed({
                title: 'Member Timed Out',
                description: `${target.user.tag} has been timed out.`,
                type: 'success',
                fields: [
                    { name: 'User', value: `${target.user.tag} (${target.id})` },
                    { name: 'Moderator', value: interaction.user.tag },
                    { name: 'Duration', value: durationString },
                    { name: 'Reason', value: reason }
                ]
            });
            
            interaction.reply({ embeds: [timeoutEmbed] });

            try {
                await target.user.send({ 
                    embeds: [createEmbed({
                        title: `You've Been Timed Out in ${interaction.guild.name}`,
                        description: `You have been timed out in ${interaction.guild.name}.`,
                        type: 'error',
                        fields: [
                            { name: 'Duration', value: durationString },
                            { name: 'Reason', value: reason },
                            { name: 'Timed Out By', value: interaction.user.tag }
                        ]
                    })]
                });
            } catch (dmError) {
                logger.warn(`Couldn't send DM to ${target.user.tag}`);
            }
            
        } catch (error) {
            logger.error(`Error timing out ${target.user.tag}:`, error);
            
            interaction.reply({ 
                embeds: [createEmbed({
                    title: 'Command Error',
                    description: `Failed to timeout ${target.user.tag}: ${error.message}`,
                    type: 'error'
                })],
                ephemeral: true
            });
        }
    }
};