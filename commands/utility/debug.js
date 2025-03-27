const { SlashCommandBuilder } = require('discord.js');
const { createEmbed } = require('../../utils/embedBuilder');
const os = require('os');

module.exports = {
    name: 'debug',
    description: 'Show debugging information',
    category: 'utility',
    
    // Slash command definition
    slashCommand: new SlashCommandBuilder()
        .setName('debug')
        .setDescription('Show debugging information'),
    
    async execute(message, args, client) {
        try {
            const nodeVersion = process.version;
            const discordJsVersion = require('../../package.json').dependencies['discord.js'];
            const uptime = formatUptime(client.uptime);
            const memoryUsage = `${Math.round(process.memoryUsage().heapUsed / 1024 / 1024)} MB`;
            const serverCount = client.guilds.cache.size;
            const pingLatency = `${Math.round(client.ws.ping)}ms`;
            
            // Get system info
            const systemInfo = getSystemInfo();
            
            // Get packages info
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
                        `**Discord.js:** ${discordJsVersion}`
                    },
                    { name: 'Installed Packages', value: packages },
                    { name: 'System Information', value: '```' + systemInfo + '```' }
                ]
            });
            
            message.reply({ embeds: [debugEmbed] });
        } catch (error) {
            console.error("Debug command error:", error);
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
            
            // Get system info
            const systemInfo = getSystemInfo();
            
            // Get packages info
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
                        `**Discord.js:** ${discordJsVersion}`
                    },
                    { name: 'Installed Packages', value: packages },
                    { name: 'System Information', value: '```' + systemInfo + '```' }
                ]
            });
            
            interaction.editReply({ embeds: [debugEmbed] });
        } catch (error) {
            console.error("Debug command error:", error);
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

// Helper function to format uptime
function formatUptime(ms) {
    const seconds = Math.floor((ms / 1000) % 60);
    const minutes = Math.floor((ms / (1000 * 60)) % 60);
    const hours = Math.floor((ms / (1000 * 60 * 60)) % 24);
    const days = Math.floor(ms / (1000 * 60 * 60 * 24));
    
    return `${days}d ${hours}h ${minutes}m ${seconds}s`;
}

// Get system info in a cross-platform way
function getSystemInfo() {
    try {
        const platform = os.platform();
        const release = os.release();
        const type = os.type();
        const arch = os.arch();
        const totalMem = Math.round(os.totalmem() / (1024 * 1024 * 1024) * 100) / 100;
        const freeMem = Math.round(os.freemem() / (1024 * 1024 * 1024) * 100) / 100;
        
        // Safely get CPU info
        let cpuInfo = "Unknown";
        const cpus = os.cpus();
        if (cpus && cpus.length > 0 && cpus[0] && cpus[0].model) {
            cpuInfo = `${cpus.length}x ${cpus[0].model}`;
        } else if (cpus && cpus.length > 0) {
            cpuInfo = `${cpus.length} CPU cores`;
        } else {
            cpuInfo = "CPU information unavailable";
        }
        
        return `Platform: ${platform} ${release} (${type})
Architecture: ${arch}
CPUs: ${cpuInfo}
Memory: ${freeMem}GB free of ${totalMem}GB`;
    } catch (error) {
        console.error("Error getting system info:", error);
        return `Error retrieving system info: ${error.message}`;
    }
}