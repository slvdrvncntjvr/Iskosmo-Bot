const { SlashCommandBuilder } = require('discord.js');
const { createEmbed } = require('../../utils/embedBuilder');
const { exec } = require('child_process');
const os = require('os');

module.exports = {
    name: 'debug',
    description: 'Show debugging information',
    category: 'utility',

    slashCommand: new SlashCommandBuilder()
        .setName('debug')
        .setDescription('Show debugging information'),
    
    async execute(message, args, client) {
        try {
            await message.channel.sendTyping();
            const nodeVersion = process.version;
            const discordJsVersion = require('../../package.json').dependencies['discord.js'];
            const uptime = formatUptime(client.uptime);
            const memoryUsage = `${Math.round(process.memoryUsage().heapUsed / 1024 / 1024)} MB`;
            const serverCount = client.guilds.cache.size;
            const pingLatency = `${Math.round(client.ws.ping)}ms`;

            const systemInfo = getSystemInfo();

            tryGetFFmpegVersion((ffmpegVersion) => {
                const packages = Object.keys(require('../../package.json').dependencies).join(', ');

                const debugEmbed = createEmbed({
                    title: '🔧 Debug Information',
                    description: 'System and environment information',
                    type: 'info',
                    fields: [
                        { name: 'Bot Info', value: 
                            `**Uptime:** ${uptime}\n` +
                            `**Memory Usage:** ${memoryUsage}\n` +
                            `**Servers:** ${serverCount}\n` +
                            `**Ping:** ${pingLatency}`
                        },
                        { name: 'Environment', value: 
                            `**Node.js:** ${nodeVersion}\n` +
                            `**Discord.js:** ${discordJsVersion}\n` +
                            `**FFmpeg:** ${ffmpegVersion}`
                        },
                        { name: 'Installed Packages', value: packages },
                        { name: 'System Information', value: '```' + systemInfo + '```' }
                    ]
                });
                
                message.reply({ embeds: [debugEmbed] });
            });
        } catch (error) {
            message.reply({
                embeds: [createEmbed({
                    title: 'Error',
                    description: `Failed to get debug info: ${error.message}`,
                    type: 'error'
                })]
            });
        }
    },
    
    async executeSlash(interaction, client) {
        await interaction.deferReply();
        
        try {
            const nodeVersion = process.version;
            const discordJsVersion = require('../../package.json').dependencies['discord.js'];
            const uptime = formatUptime(client.uptime);
            const memoryUsage = `${Math.round(process.memoryUsage().heapUsed / 1024 / 1024)} MB`;
            const serverCount = client.guilds.cache.size;
            const pingLatency = `${Math.round(client.ws.ping)}ms`;

            const systemInfo = getSystemInfo();

            tryGetFFmpegVersion((ffmpegVersion) => {
                const packages = Object.keys(require('../../package.json').dependencies).join(', ');

                const debugEmbed = createEmbed({
                    title: '🔧 Debug Information',
                    description: 'System and environment information',
                    type: 'info',
                    fields: [
                        { name: 'Bot Info', value: 
                            `**Uptime:** ${uptime}\n` +
                            `**Memory Usage:** ${memoryUsage}\n` +
                            `**Servers:** ${serverCount}\n` +
                            `**Ping:** ${pingLatency}`
                        },
                        { name: 'Environment', value: 
                            `**Node.js:** ${nodeVersion}\n` +
                            `**Discord.js:** ${discordJsVersion}\n` +
                            `**FFmpeg:** ${ffmpegVersion}`
                        },
                        { name: 'Installed Packages', value: packages },
                        { name: 'System Information', value: '```' + systemInfo + '```' }
                    ]
                });
                
                interaction.editReply({ embeds: [debugEmbed] });
            });
        } catch (error) {
            interaction.editReply({
                embeds: [createEmbed({
                    title: 'Error',
                    description: `Failed to get debug info: ${error.message}`,
                    type: 'error'
                })]
            });
        }
    }
};

function formatUptime(ms) {
    const seconds = Math.floor((ms / 1000) % 60);
    const minutes = Math.floor((ms / (1000 * 60)) % 60);
    const hours = Math.floor((ms / (1000 * 60 * 60)) % 24);
    const days = Math.floor(ms / (1000 * 60 * 60 * 24));
    
    return `${days}d ${hours}h ${minutes}m ${seconds}s`;
}

function getSystemInfo() {
    const platform = os.platform();
    const release = os.release();
    const type = os.type();
    const arch = os.arch();
    const cpus = os.cpus();
    const totalMem = Math.round(os.totalmem() / (1024 * 1024 * 1024) * 100) / 100;
    const freeMem = Math.round(os.freemem() / (1024 * 1024 * 1024) * 100) / 100;
    
    return `Platform: ${platform} ${release} (${type})
Architecture: ${arch}
CPUs: ${cpus.length}x ${cpus[0].model}
Memory: ${freeMem}GB free of ${totalMem}GB`;
}

function tryGetFFmpegVersion(callback) {
    exec('ffmpeg -version', (error, stdout) => {
        if (error) {
            callback('Not installed or not in PATH');
            return;
        }

        const firstLine = stdout.split('\n')[0];
        const versionMatch = firstLine.match(/version\s([^\s]+)/);
        
        if (versionMatch && versionMatch[1]) {
            callback(versionMatch[1]);
        } else {
            callback(firstLine);
        }
    });
}