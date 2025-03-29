const { SlashCommandBuilder } = require('discord.js');
const { createEmbed } = require('../../utils/embedBuilder');
const axios = require('axios');
const logger = require('../../utils/logger');
require('dotenv').config();

module.exports = {
    name: 'getpost',
    description: 'Get the latest posts from a Facebook page',
    usage: '<facebook_page_url> [number_of_posts]',
    category: 'utility',

    slashCommand: new SlashCommandBuilder()
        .setName('getpost')
        .setDescription('Get the latest posts from a Facebook page')
        .addStringOption(option => 
            option.setName('page')
                .setDescription('Facebook page URL or ID (leave empty for default page)')
                .setRequired(false))
        .addIntegerOption(option => 
            option.setName('count')
                .setDescription('Number of posts to retrieve (default: 1, max: 5)')
                .setMinValue(1)
                .setMaxValue(5)
                .setRequired(false)),

    async execute(message, args, client) {
        try {
            let pageIdentifier = process.env.FACEBOOK_DEFAULT_PAGE;
            let count = 1;

            if (args.length > 0) {
                pageIdentifier = args[0];

                if (args.length > 1 && !isNaN(args[1])) {
                    count = parseInt(args[1]);
                    if (count < 1) count = 1;
                    if (count > 5) count = 5;
                }
            }

            const pageId = await this.extractPageId(pageIdentifier);
            if (!pageId) {
                return message.reply({
                    embeds: [createEmbed({
                        title: 'Error',
                        description: 'Invalid Facebook page URL or ID. Please provide a valid Facebook page.',
                        type: 'error'
                    })]
                });
            }

            const loadingMessage = await message.reply({
                embeds: [createEmbed({
                    title: 'Loading...',
                    description: 'Fetching Facebook posts, please wait...',
                    type: 'info'
                })]
            });

            const posts = await this.fetchPosts(pageId, count);

            if (!posts || posts.length === 0) {
                return loadingMessage.edit({
                    embeds: [createEmbed({
                        title: 'No Posts Found',
                        description: 'No posts were found for this Facebook page.',
                        type: 'warning'
                    })]
                });
            }

            const pageName = await this.getPageName(pageId);

            const embeds = await Promise.all(posts.map(post => this.createPostEmbed(post, pageName)));

            await loadingMessage.edit({ embeds: [embeds[0]] });

            for (let i = 1; i < embeds.length; i++) {
                await message.channel.send({ embeds: [embeds[i]] });
            }

        } catch (error) {
            logger.error(`Error in getpost command: ${error.message}`);
            message.reply({
                embeds: [createEmbed({
                    title: 'Error',
                    description: 'An error occurred while fetching Facebook posts. Please try again later.',
                    type: 'error'
                })]
            });
        }
    },

    async executeSlash(interaction, client) {
        await interaction.deferReply();

        try {
            let pageIdentifier = interaction.options.getString('page') || process.env.FACEBOOK_DEFAULT_PAGE;
            let count = interaction.options.getInteger('count') || 1;

            const pageId = await this.extractPageId(pageIdentifier);
            if (!pageId) {
                return interaction.editReply({
                    embeds: [createEmbed({
                        title: 'Error',
                        description: 'Invalid Facebook page URL or ID. Please provide a valid Facebook page.',
                        type: 'error'
                    })]
                });
            }

            const posts = await this.fetchPosts(pageId, count);

            if (!posts || posts.length === 0) {
                return interaction.editReply({
                    embeds: [createEmbed({
                        title: 'No Posts Found',
                        description: 'No posts were found for this Facebook page.',
                        type: 'warning'
                    })]
                });
            }

            const pageName = await this.getPageName(pageId);

            const embeds = await Promise.all(posts.map(post => this.createPostEmbed(post, pageName)));

            await interaction.editReply({ embeds: [embeds[0]] });

            for (let i = 1; i < embeds.length; i++) {
                await interaction.followUp({ embeds: [embeds[i]] });
            }

        } catch (error) {
            logger.error(`Error in getpost slash command: ${error.message}`);
            interaction.editReply({
                embeds: [createEmbed({
                    title: 'Error',
                    description: 'An error occurred while fetching Facebook posts. Please try again later.',
                    type: 'error'
                })]
            });
        }
    },

    async extractPageId(pageIdentifier) {
        if (!pageIdentifier.includes('facebook.com')) {
            return pageIdentifier;
        }

        try {
            const url = new URL(pageIdentifier);

            if (url.pathname.split('/').length === 2) {
                return url.pathname.substring(1);
            }

            if (url.pathname.includes('/pages/')) {
                const parts = url.pathname.split('/');
                return parts[parts.length - 1];
            }

            if (url.pathname.includes('/pg/')) {
                const parts = url.pathname.split('/');
                return parts[2];
            }

            const pathSegments = url.pathname.split('/').filter(segment => segment);
            if (pathSegments.length > 0) {
                return pathSegments[pathSegments.length - 1];
            }

            return null;
        } catch (error) {
            logger.error(`Error parsing Facebook URL: ${error.message}`);
            return null;
        }
    },

    async fetchPosts(pageId, count) {
        try {
            const response = await axios.get(`https://graph.facebook.com/v18.0/${pageId}/posts`, {
                params: {
                    access_token: process.env.FACEBOOK_ACCESS_TOKEN,
                    fields: 'message,created_time,permalink_url,full_picture,attachments{type,url,media,title,description}',
                    limit: count
                }
            });

            return response.data.data;
        } catch (error) {
            logger.error(`Error fetching Facebook posts: ${error.message}`);
            if (error.response) {
                logger.error(`Facebook API error: ${JSON.stringify(error.response.data)}`);
            }
            return null;
        }
    },

    async getPageName(pageId) {
        try {
            const response = await axios.get(`https://graph.facebook.com/v18.0/${pageId}`, {
                params: {
                    access_token: process.env.FACEBOOK_ACCESS_TOKEN,
                    fields: 'name'
                }
            });

            return response.data.name || 'Facebook Page';
        } catch (error) {
            logger.error(`Error fetching page name: ${error.message}`);
            return 'Facebook Page';
        }
    },

    async createPostEmbed(post, pageName) {
        const postDate = new Date(post.created_time);
        const formattedDate = postDate.toLocaleString();
        const message = post.message || 'No text content';

        const embedOptions = {
            title: `Post from ${pageName}`,
            description: message.length > 4000 ? message.substring(0, 4000) + '...' : message,
            type: 'info',
            fields: [
                { name: 'Posted', value: formattedDate },
                { name: 'Link', value: post.permalink_url }
            ]
        };

        const embed = createEmbed(embedOptions);

        if (post.full_picture) {
            embed.setImage(post.full_picture);
        }

        try {
            const pageImageResponse = await axios.get(`https://graph.facebook.com/v18.0/${pageName}/picture`, {
                params: {
                    access_token: process.env.FACEBOOK_ACCESS_TOKEN,
                    redirect: 0,
                    type: 'large'
                }
            });

            if (pageImageResponse.data && pageImageResponse.data.data && pageImageResponse.data.data.url) {
                embed.setThumbnail(pageImageResponse.data.data.url);
            }
        } catch (error) {
            logger.warn(`Couldn't fetch page image: ${error.message}`);
        }

        if (post.attachments && post.attachments.data && post.attachments.data.length > 0) {
            const attachment = post.attachments.data[0];

            if (!post.full_picture && attachment.media && attachment.media.image && attachment.media.image.src) {
                embed.setImage(attachment.media.image.src);
            }

            if (attachment.title || attachment.description) {
                let attachmentInfo = '';
                if (attachment.title) attachmentInfo += `**${attachment.title}**\n`;
                if (attachment.description) attachmentInfo += attachment.description;

                if (attachmentInfo) {
                    embed.addFields({ name: 'Attachment', value: attachmentInfo.substring(0, 1024) });
                }
            }
        }

        return embed;
    }
};