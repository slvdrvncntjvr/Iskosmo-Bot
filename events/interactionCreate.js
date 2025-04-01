const logger = require('../utils/logger');
const { createEmbed } = require('../utils/embedBuilder');
const permissionManager = require('../utils/permissionManager');
const killSwitch = require('../utils/killSwitch');
const cooldownManager = require('../utils/cooldownManager');

module.exports = {
    once: false,
    async execute(interaction, client) {

        if (killSwitch.isKilled()) {
            if (interaction.isCommand() && 
                interaction.commandName === 'revive' && 
                permissionManager.isOwner(interaction.user.id)) {
                const downtime = killSwitch.getDowntime();
                killSwitch.revive();
                await interaction.reply({
                    embeds: [createEmbed({
                        title: '✅ Bot Revived',
                        description: `Bot operations resumed after ${downtime} seconds of suspension.`,
                        type: 'success'
                    })],
                    ephemeral: true
                });
            } else {
                return;
            }
        }

        const isBotOwner = interaction.user.id === process.env.BOT_OWNER_ID;
        const isCooldownCommand = commandName === 'cooldown';
    
        if (!isBotOwner && !isCooldownCommand) {
            const canProceed = cooldownManager.handleInteractionCooldown(interaction, commandName);
            if (!canProceed) {
                return;
            }
        }
        
        if (interaction.isCommand()) {
            const command = client.slashCommands.get(interaction.commandName);
            
            if (!command) return;

            if (command.requiresAuth && !permissionManager.isAuthorized(interaction.user.id, interaction.commandName)) {
                return interaction.reply({ 
                    embeds: [createEmbed({
                        title: 'Permission Error',
                        description: 'You are not authorized to use this command.',
                        type: 'error'
                    })],
                    ephemeral: true
                });
            }
            
            try {
                await command.executeSlash(interaction, client);
                logger.info(`${interaction.user.tag} used slash command: ${interaction.commandName}`);
                logger.logToDiscord(client, `${interaction.user.tag} used slash command: ${interaction.commandName} in ${interaction.guild.name}`);
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
