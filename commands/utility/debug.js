// commands/utility/debug.js
const { SlashCommandBuilder } = require('discord.js');
const { createEmbed } = require('../../utils/embedBuilder');
const { exec } = require('child_process');

module.exports = {
    name: 'debug',
    description: 'Show debugging information',
    category: 'utility',
    
    async execute(message, args, client) {
        try {
            // Get Node.js version
            const nodeVersion = process.version;
            
            // Get FFmpeg version
            exec('ffmpeg -version', (error, stdout) => {
                const ffmpegVersion = error ? 'Not found' : stdout.split('\n')[0];
                
                // Get package information
                const packages = Object.keys(require('../../package.json').dependencies).join(', ');
                
                // Get system info
                exec('free -h && uname -a', (error2, stdout2) => {
                    const systemInfo = error2 ? 'Not available' : stdout2;
                    
                    // Create and send debug embed
                    const debugEmbed = createEmbed({
                        title: '🔧 Debug Information',
                        description: 'System and environment information',
                        type: 'info',
                        fields: [
                            { name: 'Node.js Version', value: nodeVersion },
                            { name: 'FFmpeg Version', value: ffmpegVersion },
                            { name: 'Installed Packages', value: packages },
                            { name: 'System Information', value: '```' + systemInfo + '```' }
                        ]
                    });
                    
                    message.reply({ embeds: [debugEmbed] });
                });
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
    }
};