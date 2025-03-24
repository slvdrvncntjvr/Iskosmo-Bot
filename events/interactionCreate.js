const logger = require('../utils/logger');
const { createEmbed } = require('../utils/embedBuilder');

module.exports = {
    once: false,
    async execute(interaction, client) {
        if (interaction.isCommand()) {
            const command = client.slashCommands.get(interaction.commandName);
            
            if (!command) return;
            
            try {
                await command.executeSlash(interaction, client);
                logger.info(`${interaction.user.tag} used slash command: ${interaction.commandName}`);
            } catch (error) {
                logger.error(`Error executing slash command ${interaction.commandName}:`, error);
                
                const errorEmbed = createEmbed({
                    title: 'Command Error',
                    description: 'There was an error executing that command.',
                    type: 'error'
                });
                
                if (interaction.replied || interaction.deferred) {
                    await interaction.followUp({ embeds: [errorEmbed], ephemeral: true });
                } else {
                    await interaction.reply({ embeds: [errorEmbed], ephemeral: true });
                }
            }
        }
    },
};