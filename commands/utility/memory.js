const { SlashCommandBuilder } = require('discord.js');
const { createEmbed } = require('../../utils/embedBuilder');
const os = require('os');

module.exports = {
    name: 'memory',
    description: 'Display current memory usage of the bot',
    category: 'utility',
    requiresAuth: true,
    
    slashCommand: new SlashCommandBuilder()
        .setName('memory')
        .setDescription('Display current memory usage of the bot'),
    
    async execute(message, args, client) {
        if (!client.memoryManager) {
            return message.reply({
                embeds: [createEmbed({
                    title: 'Memory Status',
                    description: 'Memory manager not initialized',
                    type: 'error'
                })]
            });
        }
        
        const memStatus = client.memoryManager.getMemoryStatus();
        const uptime = this.formatUptime(process.uptime());
        
        return message.reply({
            embeds: [createEmbed({
                title: '🧠 Memory Status',
                description: memStatus.inRecoveryMode ? 
                    '⚠️ **BOT IS IN MEMORY RECOVERY MODE**\nSome features may be limited to preserve stability.' : 
                    'Memory usage statistics for the bot',
                type: memStatus.inRecoveryMode ? 'warning' : 'info',
                fields: [
                    { name: 'Bot Heap Usage', value: `${memStatus.heapUsed}MB / ${memStatus.heapTotal}MB`, inline: true },
                    { name: 'System Memory', value: `${memStatus.systemFree}MB free / ${memStatus.systemTotal}MB total`, inline: true },
                    { name: 'System Usage', value: `${memStatus.systemUsedPercent.toFixed(1)}%`, inline: true },
                    { name: 'Uptime', value: uptime, inline: true },
                    { name: 'Recovery Mode', value: memStatus.inRecoveryMode ? 'Active' : 'Inactive', inline: true }
                ]
            })]
        });
    },
    
    async executeSlash(interaction, client) {
        if (!client.memoryManager) {
            return interaction.reply({
                embeds: [createEmbed({
                    title: 'Memory Status',
                    description: 'Memory manager not initialized',
                    type: 'error'
                })],
                ephemeral: true
            });
        }
        
        const memStatus = client.memoryManager.getMemoryStatus();
        const uptime = this.formatUptime(process.uptime());
        
        return interaction.reply({
            embeds: [createEmbed({
                title: '🧠 Memory Status',
                description: memStatus.inRecoveryMode ? 
                    '⚠️ **BOT IS IN MEMORY RECOVERY MODE**\nSome features may be limited to preserve stability.' : 
                    'Memory usage statistics for the bot',
                type: memStatus.inRecoveryMode ? 'warning' : 'info',
                fields: [
                    { name: 'Bot Heap Usage', value: `${memStatus.heapUsed}MB / ${memStatus.heapTotal}MB`, inline: true },
                    { name: 'System Memory', value: `${memStatus.systemFree}MB free / ${memStatus.systemTotal}MB total`, inline: true },
                    { name: 'System Usage', value: `${memStatus.systemUsedPercent.toFixed(1)}%`, inline: true },
                    { name: 'Uptime', value: uptime, inline: true },
                    { name: 'Recovery Mode', value: memStatus.inRecoveryMode ? 'Active' : 'Inactive', inline: true }
                ]
            })]
        });
    },
    
    formatUptime(seconds) {
        const days = Math.floor(seconds / 86400);
        const hours = Math.floor((seconds % 86400) / 3600);
        const minutes = Math.floor((seconds % 3600) / 60);
        const secs = Math.floor(seconds % 60);
        
        const parts = [];
        if (days > 0) parts.push(`${days}d`);
        if (hours > 0) parts.push(`${hours}h`);
        if (minutes > 0) parts.push(`${minutes}m`);
        if (secs > 0 || parts.length === 0) parts.push(`${secs}s`);
        
        return parts.join(' ');
    }
};