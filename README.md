# Iskosmo Bot v1.0.0

<p align="center">
  <img src="https://i.imgur.com/YourLogoHere.png" alt="Iskosmo Bot Logo" width="200"/>
</p>

> A versatile Discord bot built to run efficiently even on resource-constrained devices.

## ✨ Features

- **Custom Permission System**: Advanced permission management beyond Discord's role system
- **YouTube Integration**: Fetch the latest videos from any YouTube channel
- **Message Snipe**: Recover recently deleted messages
- **Mobile-Optimized**: Designed to run efficiently on tablets and mobile devices
- **Self-Healing**: Intelligent status recovery and memory management
- **Emergency Kill Switch**: Remote shutdown capability from any server

## 🚀 Commands

### Fun Commands
- `!joke` - Get a random joke
- `!snipe` - Recover the last deleted message in a channel

### Moderation Commands
- `!ban` - Ban a user from the server
- `!kick` - Kick a user from the server

### Utility Commands
- `!announce` - Send announcements to a specific channel
- `!auth` - Manage command permissions
- `!debug` - Display bot diagnostics
- `!getvid` - Fetch latest videos from a YouTube channel
- `!help` - Display command help
- `!logchannel` - Set up a logging channel
- `!ping` - Check the bot's response time
- `!power` - Manage power settings
- `!statusset` - Set a temporary status for the bot

## 💻 Technical Features

- **Mobile-First Design**: Optimized for running on ARM devices like tablets
- **Memory Management**: Intelligent caching and cleanup to prevent memory issues
- **Thermal Throttling**: Adjusts performance based on device temperature
- **Battery Awareness**: Changes behavior based on battery level
- **Command Queueing**: Prioritizes lightweight commands when resources are constrained
- **Health Monitoring**: Built-in HTTP endpoint for status checks

## 📊 Resource Usage

Iskosmo Bot is designed to be lightweight:
- Memory: ~75MB base usage
- CPU: Minimal impact during idle
- Network: Low bandwidth requirements
- Storage: <10MB (excluding logs)

## 🛠 Setup

1. Clone this repository
2. Install dependencies:
   npm install
3. Create a `.env` file with the following:
   DISCORD_BOT_TOKEN=your_token_here
   BOT_OWNER_ID=your_discord_id
   YOUTUBE_API_KEY=your_youtube_api_key
4. Start the bot:
   node --expose-gc index.js

### Running on Mobile/Tablet (Termux)

For Samsung devices or other Android tablets:

1. Install Termux from F-Droid
2. Set up Node.js environment:
   pkg install nodejs
   pkg install git
3. Clone and set up the bot as above
4. For improved device integration:
   pkg install termux-api
5. Keep the bot running when screen is off:
   termux-wake-lock
   node --expose-gc index.js

## 🔧 Architecture

Iskosmo Bot uses a modular architecture:
- **Command Categories**: Organized by functionality
- **Event-Driven**: Responds to Discord events
- **Utility Modules**: Core functionality abstracted into reusable components
- **Self-Healing**: Monitors and recovers from common failure modes

## 🔒 Security

- **Custom Auth System**: Fine-grained control over who can use sensitive commands
- **Emergency Kill Switch**: Quickly disable the bot with a special command
- **Permission Checking**: Multiple layers of permission validation

## 📝 License

This project is licensed under the MIT License - see the LICENSE file for details.

## 🙏 Acknowledgements

- [Discord.js](https://discord.js.org/) - The amazing library that makes this possible
- [Node.js](https://nodejs.org/) - For running efficiently even on mobile devices
- All the awesome users and testers who provided feedback

---

<p align="center">
  Made with ❤️ by <a href="https://github.com/slvdrvncntjvr">slvdrvncntjvr</a>
</p>
