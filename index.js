require('dotenv').config();
const { Client, GatewayIntentBits, Collection } = require('discord.js');

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
    ]
});


client.commands = new Collection();
const prefix = '!'; 


const commands = {
    ping: {
        name: 'ping',
        description: 'Replies with Pong!',
        execute(message) {
            message.reply('Pong! 🏓');
        }
    },
    help: {
        name: 'help',
        description: 'Shows available commands',
        execute(message) {
            const commandList = Array.from(client.commands.values())
                .map(cmd => `**${prefix}${cmd.name}** - ${cmd.description}`)
                .join('\n');
            
            message.reply(`**Available Commands:**\n${commandList}`);
        }
    }
};

for (const command of Object.values(commands)) {
    client.commands.set(command.name, command);
}

client.once('ready', () => {
    console.log(`Logged in as ${client.user.tag}!`);
    console.log(`Serving in ${client.guilds.cache.size} servers`);
});

client.on('messageCreate', message => {
    if (message.author.bot) return;
    
    if (message.content.startsWith(prefix)) {
        const args = message.content.slice(prefix.length).trim().split(/ +/);
        const commandName = args.shift().toLowerCase();
        
        if (!client.commands.has(commandName)) return;
        
        try {
            client.commands.get(commandName).execute(message, args);
        } catch (error) {
            console.error(error);
            message.reply('There was an error trying to execute that command!');
        }
    }
});

const token = process.env.DISCORD_BOT_TOKEN;
if (!token) {
    console.error('DISCORD_BOT_TOKEN is not defined in your .env file!');
    process.exit(1);
}

client.login(token).catch(error => {
    console.error('Failed to login:', error);
    process.exit(1);
});
