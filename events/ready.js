const { REST, Routes, ActivityType } = require('discord.js');
const logger = require('../utils/logger');
const StatusManager = require('../utils/statusManager'); 

module.exports = {
    once: true,
    async execute(client) {
        const guildCount = client.guilds.cache.size;
        
        logger.info(`Logged in as ${client.user.tag}`);
        logger.info(`Serving ${guildCount} guilds`);

        client.statusManager = new StatusManager(client);
        client.statusManager.startRotation();

        logger.logToDiscord(client, `Bot is online and serving in ${client.guilds.cache.size} guilds`);

        client.user.setPresence({
            activities: [
                {
                    name: `in ${guildCount} guilds`,
                    type: ActivityType.Playing
                }
            ],
            status: 'online'
        });

        logger.logToDiscord(client, `Bot is online and serving in ${guildCount} guilds`);

        try {
            const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_BOT_TOKEN);
            
            const slashCommands = Array.from(client.slashCommands.values())
                .map(cmd => cmd.slashCommand.toJSON());
            
            if (slashCommands.length > 0) {
                logger.info(`Started refreshing ${slashCommands.length} application (/) commands.`);
                
                const data = await rest.put(
                    Routes.applicationCommands(client.user.id),
                    { body: slashCommands },
                );
                
                logger.info(`Successfully reloaded ${data.length} application (/) commands.`);
            }
        } catch (error) {
            logger.error('Error registering slash commands:', error);
        }
    },
};