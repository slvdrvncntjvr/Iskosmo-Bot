const { SlashCommandBuilder } = require('discord.js');
const { createEmbed } = require('../../utils/embedBuilder');
const { google } = require('googleapis');
const logger = require('../../utils/logger');

module.exports = {
    name: 'getvid',
    description: 'Get the latest videos from a YouTube channel',
    usage: '<channel> [amount]',
    category: 'utility',
    
    slashCommand: new SlashCommandBuilder()
        .setName('getvid')
        .setDescription('Get the latest videos from a YouTube channel')
        .addStringOption(option => 
            option.setName('channel')
                .setDescription('YouTube channel name or ID')
                .setRequired(true))
        .addIntegerOption(option => 
            option.setName('amount')
                .setDescription('Number of videos to retrieve (default: 1, max: 5)')
                .setRequired(false)
                .setMinValue(1)
                .setMaxValue(5)),
    
    async execute(message, args, client) {
        if (!args.length) {
            return message.reply({
                embeds: [createEmbed({
                    title: 'Error',
                    description: `You need to provide a YouTube channel. Usage: \`!${this.name} ${this.usage}\``,
                    type: 'error'
                })]
            });
        }

        const channelQuery = args[0];
        let amount = 1;

        if (args.length > 1 && !isNaN(args[1])) {
            amount = parseInt(args[1]);
            if (amount < 1) amount = 1;
            if (amount > 5) amount = 5; // Limit to 5 to avoid API quota issues
        }

        message.channel.sendTyping();
        
        try {
            const videos = await this.getYoutubeVideos(channelQuery, amount);
            
            if (!videos || videos.length === 0) {
                return message.reply({
                    embeds: [createEmbed({
                        title: 'No Videos Found',
                        description: 'Could not find any videos for this channel. Make sure the channel exists and is public.',
                        type: 'warning'
                    })]
                });
            }
            
            const responseEmbed = createEmbed({
                title: `Latest ${videos.length > 1 ? videos.length + ' Videos' : 'Video'} from ${videos[0].channelTitle}`,
                description: videos.map((video, index) => 
                    `${index + 1}. [${video.title}](https://www.youtube.com/watch?v=${video.videoId})`
                ).join('\n\n'),
                type: 'info'
            });
            
            message.reply({ embeds: [responseEmbed] });
        } catch (error) {
            logger.error(`Error in getvid command:`, error);
            
            message.reply({
                embeds: [createEmbed({
                    title: 'Error',
                    description: 'An error occurred while fetching YouTube videos: ' + error.message,
                    type: 'error'
                })]
            });
        }
    },
    
    async executeSlash(interaction, client) {
        await interaction.deferReply();
        
        const channelQuery = interaction.options.getString('channel');
        const amount = interaction.options.getInteger('amount') || 1;
        
        try {
            const videos = await this.getYoutubeVideos(channelQuery, amount);
            
            if (!videos || videos.length === 0) {
                return interaction.editReply({
                    embeds: [createEmbed({
                        title: 'No Videos Found',
                        description: 'Could not find any videos for this channel. Make sure the channel exists and is public.',
                        type: 'warning'
                    })]
                });
            }
            
            const responseEmbed = createEmbed({
                title: `Latest ${videos.length > 1 ? videos.length + ' Videos' : 'Video'} from ${videos[0].channelTitle}`,
                description: videos.map((video, index) => 
                    `${index + 1}. [${video.title}](https://www.youtube.com/watch?v=${video.videoId})`
                ).join('\n\n'),
                type: 'info'
            });
            
            interaction.editReply({ embeds: [responseEmbed] });
        } catch (error) {
            logger.error(`Error in getvid slash command:`, error);
            
            interaction.editReply({
                embeds: [createEmbed({
                    title: 'Error',
                    description: 'An error occurred while fetching YouTube videos: ' + error.message,
                    type: 'error'
                })]
            });
        }
    },
    
    async getYoutubeVideos(channelQuery, maxResults = 1) {
        const youtube = google.youtube({
            version: 'v3',
            auth: process.env.YOUTUBE_API_KEY
        });

        const channelResponse = await youtube.search.list({
            part: 'snippet',
            q: channelQuery,
            type: 'channel',
            maxResults: 1
        });
        
        if (!channelResponse.data.items || channelResponse.data.items.length === 0) {
            throw new Error('Channel not found');
        }
        
        const channelId = channelResponse.data.items[0].id.channelId;
        const channelTitle = channelResponse.data.items[0].snippet.title;

        const videosResponse = await youtube.search.list({
            part: 'snippet',
            channelId: channelId,
            order: 'date',
            type: 'video',
            maxResults: maxResults
        });
        
        if (!videosResponse.data.items || videosResponse.data.items.length === 0) {
            return [];
        }
        
        return videosResponse.data.items.map(item => ({
            videoId: item.id.videoId,
            title: item.snippet.title,
            description: item.snippet.description,
            publishedAt: item.snippet.publishedAt,
            channelTitle: channelTitle
        }));
    }
};