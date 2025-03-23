require('dotenv').config();
console.log("Token is: ", process.env.DISCORD_BOT_TOKEN);

const { Client, GatewayIntentBits } = require('discord.js');

const client = new Client({
	intents: [
	GatewayIntentBits.Guilds,
	GatewayIntentBits.GuildMessages,
	GatewayIntentBits.MessageContent,
	]
});

//inserting token

const token = process.env.DISCORD_BOT_TOKEN || 'token';

client.once('ready', () => {
	console.log(`Logged in as ${client.user.tag}!`);
});

client.on('messageCreate', message => {
	if (message.author.bot) return;
	if (message.content.toLowerCase() === 'ping') {
		message.channel.send('pong');
	}
});

client.login(token).catch(err => {
	console.error('Failed to login:', err);
});
