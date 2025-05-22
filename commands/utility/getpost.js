const { SlashCommandBuilder } = require('discord.js');
const { createEmbed } = require('../../utils/embedBuilder');
const axios = require('axios');
const logger = require('../../utils/logger');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

// Path for storing Facebook post settings
const FB_SETTINGS_PATH = path.join(__dirname, '../../data/facebookSettings.json');

// Load or create settings file
let fbSettings = {};
try {
    if (fs.existsSync(FB_SETTINGS_PATH)) {
        fbSettings = JSON.parse(fs.readFileSync(FB_SETTINGS_PATH, 'utf8'));
    } else {
        fs.writeFileSync(FB_SETTINGS_PATH, JSON.stringify(fbSettings), 'utf8');
    }
} catch (error) {
    logger.error('Failed to load Facebook settings:', error);
}

// Save settings function
function saveSettings() {
    try {
        fs.writeFileSync(FB_SETTINGS_PATH, JSON.stringify(fbSettings, null, 2), 'utf8');
    } catch (error) {
        logger.error('Failed to save Facebook settings:', error);
    }
}

module.exports = {
    name: 'getpost',
    description: 'Get the latest posts from a Facebook page',
    usage: '<facebook_page_url> [number_of_posts]',
    category: 'utility',

    // Restructured slash command to avoid mixing subcommands with root-level options
    slashCommand: new SlashCommandBuilder()
        .setName('getpost')
        .setDescription('Get the latest posts from a Facebook page')
        .addSubcommand(subcommand =>
            subcommand
                .setName('fetch')
                .setDescription('Fetch posts from a Facebook page')
                .addStringOption(option => 
                    option.setName('page')
                        .setDescription('Facebook page URL or ID (leave empty for default page)')
                        .setRequired(false))
                .addIntegerOption(option => 
                    option.setName('count')
                        .setDescription('Number of posts to retrieve (default: 1, max: 5)')
                        .setMinValue(1)
                        .setMaxValue(5)
                        .setRequired(false)))
        .addSubcommand(subcommand =>
            subcommand
                .setName('set_channel')
                .setDescription('Set a default channel for FB post updates')
                .addChannelOption(option =>
                    option.setName('channel')
                        .setDescription('The channel for Facebook post updates')
                        .setRequired(true)))
        .addSubcommand(subcommand =>
            subcommand
                .setName('set_page')
                .setDescription('Set a default Facebook page')
                .addStringOption(option =>
                    option.setName('page_id')
                        .setDescription('Facebook page ID or URL')
                        .setRequired(true)))
        .addSubcommand(subcommand =>
            subcommand
                .setName('view')
                .setDescription('View current Facebook post settings'))
        .addSubcommand(subcommand =>
            subcommand
                .setName('auto')
                .setDescription('Toggle automatic posting of new Facebook posts')
                .addBooleanOption(option =>
                    option.setName('enabled')
                        .setDescription('Enable or disable automatic posting')
                        .setRequired(true))
                .addIntegerOption(option =>
                    option.setName('interval')
                        .setDescription('Check interval in minutes (default: 30, min: 5)')
                        .setMinValue(5)
                        .setRequired(false))),

    async execute(message, args, client) {
        try {
            if (!args.length || ['set_channel', 'set_page', 'view', 'auto'].includes(args[0].toLowerCase())) {
                const action = !args.length ? 'view' : args[0].toLowerCase();
                
                // Handle configuration commands
                if (action === 'set_channel') {
                    const channel = message.mentions.channels.first();
                    if (!channel) {
                        return message.reply({
                            embeds: [createEmbed({
                                title: 'Error',
                                description: 'Please mention a channel to set for Facebook posts.',
                                type: 'error'
                            })]
                        });
                    }
                    
                    return this.setChannel(message, message.guild.id, channel);
                }
                
                if (action === 'set_page') {
                    if (args.length < 2) {
                        return message.reply({
                            embeds: [createEmbed({
                                title: 'Error',
                                description: 'Please provide a Facebook page ID or URL.',
                                type: 'error'
                            })]
                        });
                    }
                    
                    return this.setDefaultPage(message, message.guild.id, args[1]);
                }
                
                if (action === 'auto') {
                    if (args.length < 2 || !['on', 'off'].includes(args[1].toLowerCase())) {
                        return message.reply({
                            embeds: [createEmbed({
                                title: 'Error',
                                description: 'Please specify "on" or "off" to enable/disable automatic posting.',
                                type: 'error'
                            })]
                        });
                    }
                    
                    const enabled = args[1].toLowerCase() === 'on';
                    let interval = 30; // Default 30 minutes
                    
                    if (args.length > 2 && !isNaN(args[2])) {
                        interval = parseInt(args[2]);
                        if (interval < 5) interval = 5; // Minimum 5 minutes
                    }
                    
                    return this.toggleAutoPost(message, message.guild.id, enabled, interval);
                }
                
                if (action === 'view') {
                    return this.viewSettings(message, message.guild.id);
                }
            }

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
            const subcommand = interaction.options.getSubcommand();
            
            if (subcommand === 'set_channel') {
                const channel = interaction.options.getChannel('channel');
                return this.setChannel(interaction, interaction.guild.id, channel);
            }
            
            if (subcommand === 'set_page') {
                const page = interaction.options.getString('page_id');
                return this.setDefaultPage(interaction, interaction.guild.id, page);
            }
            
            if (subcommand === 'view') {
                return this.viewSettings(interaction, interaction.guild.id);
            }
            
            if (subcommand === 'auto') {
                const enabled = interaction.options.getBoolean('enabled');
                const interval = interaction.options.getInteger('interval') || 30;
                return this.toggleAutoPost(interaction, interaction.guild.id, enabled, interval);
            }
            
            // This is now the 'fetch' subcommand
            if (subcommand === 'fetch') {
                let pageIdentifier = interaction.options.getString('page') || process.env.FACEBOOK_DEFAULT_PAGE;
                
                // If no page specified, try to get guild's default page
                if (!pageIdentifier && fbSettings[interaction.guild.id] && fbSettings[interaction.guild.id].defaultPage) {
                    pageIdentifier = fbSettings[interaction.guild.id].defaultPage;
                }
                
                if (!pageIdentifier) {
                    return interaction.editReply({
                        embeds: [createEmbed({
                            title: 'Error',
                            description: 'No Facebook page specified and no default page set. Please provide a page or set a default page.',
                            type: 'error'
                        })]
                    });
                }
                
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
        // First check if this might be a command like "help" that isn't a page ID
        if (!pageIdentifier || ['help', 'set_channel', 'set_page', 'view', 'auto'].includes(pageIdentifier.toLowerCase())) {
            return null;
        }
        
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
            // Log info about the token we're using
            try {
                const tokenInfo = await axios.get('https://graph.facebook.com/v18.0/debug_token', {
                    params: {
                        input_token: process.env.FACEBOOK_ACCESS_TOKEN,
                        access_token: process.env.FACEBOOK_ACCESS_TOKEN
                    }
                });
                logger.info(`Token info: ${JSON.stringify(tokenInfo.data)}`);
                
                // Check if token is a user token rather than a page token
                if (tokenInfo.data && tokenInfo.data.data && tokenInfo.data.data.type === "USER") {
                    logger.warn("Using a USER token. For the new Pages experience, a PAGE access token is required.");
                    
                    // Try to get page access token if page ID and user token are available
                    try {
                        const pageTokenResponse = await axios.get(`https://graph.facebook.com/v18.0/${pageId}`, {
                            params: {
                                fields: 'access_token',
                                access_token: process.env.FACEBOOK_ACCESS_TOKEN
                            }
                        });
                        
                        if (pageTokenResponse.data && pageTokenResponse.data.access_token) {
                            logger.info(`Successfully obtained page access token for page ${pageId}`);
                            // Use the page token for subsequent requests
                            const pageAccessToken = pageTokenResponse.data.access_token;
                            return this.fetchPostsWithToken(pageId, count, pageAccessToken);
                        }
                    } catch (pageTokenError) {
                        logger.error(`Failed to obtain page access token: ${pageTokenError.message}`);
                        if (pageTokenError.response) {
                            logger.error(`Facebook API error: ${JSON.stringify(pageTokenError.response.data)}`);
                        }
                    }
                }
            } catch (tokenError) {
                logger.warn(`Could not debug token: ${tokenError.message}`);
            }

            // Try to get page info first
            try {
                const pageInfo = await axios.get(`https://graph.facebook.com/v18.0/${pageId}`, {
                    params: {
                        access_token: process.env.FACEBOOK_ACCESS_TOKEN,
                        fields: 'id,name'
                    }
                });
                logger.info(`Page info: ${JSON.stringify(pageInfo.data)}`);
            } catch (pageError) {
                logger.warn(`Could not get page info: ${pageError.message}`);
            }

            // If we didn't get a page token above, try with the provided token
            return this.fetchPostsWithToken(pageId, count, process.env.FACEBOOK_ACCESS_TOKEN);
            
        } catch (error) {
            logger.error(`Error fetching Facebook posts: ${error.message}`);
            if (error.response) {
                logger.error(`Facebook API error: ${JSON.stringify(error.response.data)}`);
            }
            return null;
        }
    },
    
    // New helper method to fetch posts with a specific token
    async fetchPostsWithToken(pageId, count, accessToken) {
        // Alternative approach that works with both User and Page tokens
        // First, try to fetch the page feed directly (works with Page tokens)
        try {
            const response = await axios.get(`https://graph.facebook.com/v18.0/${pageId}/feed`, {
                params: {
                    access_token: accessToken,
                    fields: 'message,created_time,permalink_url,full_picture,attachments{type,url,media,title,description}',
                    limit: count
                }
            });
            
            if (response.data && response.data.data && response.data.data.length > 0) {
                return response.data.data;
            }
        } catch (error) {
            logger.warn(`Direct page feed fetch failed, trying alternative method: ${error.message}`);
            // Continue to alternative method if this fails
        }
        
        // Alternative method using the /posts endpoint (might work better with User tokens)
        try {
            const response = await axios.get(`https://graph.facebook.com/v18.0/${pageId}/posts`, {
                params: {
                    access_token: accessToken,
                    fields: 'message,created_time,permalink_url,full_picture,attachments{type,url,media,title,description}',
                    limit: count
                }
            });
            
            if (response.data && response.data.data) {
                return response.data.data;
            }
        } catch (directError) {
            logger.warn(`Posts endpoint fetch failed: ${directError.message}`);
            
            // Last resort - try using the Graph API search function
            try {
                const searchResponse = await axios.get(`https://graph.facebook.com/v18.0/search`, {
                    params: {
                        access_token: accessToken,
                        q: "", // Empty search query to get all posts
                        type: "post",
                        fields: 'message,created_time,permalink_url,full_picture,attachments{type,url,media,title,description}',
                        limit: count,
                        filtering: JSON.stringify([{"field":"place","operator":"CONTAIN","value":`${pageId}`}])
                    }
                });
                
                if (searchResponse.data && searchResponse.data.data) {
                    return searchResponse.data.data;
                }
            } catch (searchError) {
                logger.error(`Search endpoint failed: ${searchError.message}`);
                if (searchError.response) {
                    logger.error(`Facebook API search error: ${JSON.stringify(searchError.response.data)}`);
                }
                
                // If all methods fail, throw the original error
                throw directError;
            }
        }
        
        // If we get here with no results, return an empty array
        return [];
    },

    async getPageName(pageId) {
        try {
            // First try the regular method
            try {
                const response = await axios.get(`https://graph.facebook.com/v18.0/${pageId}`, {
                    params: {
                        access_token: process.env.FACEBOOK_ACCESS_TOKEN,
                        fields: 'name'
                    }
                });

                if (response.data && response.data.name) {
                    return response.data.name;
                }
            } catch (error) {
                logger.warn(`Standard page name fetch failed: ${error.message}`);
                // Continue to alternative methods
            }
            
            // Try alternative method for public page info
            try {
                const response = await axios.get(`https://graph.facebook.com/v18.0/${pageId}`, {
                    params: {
                        metadata: 1,
                        fields: 'name,username',
                        access_token: process.env.FACEBOOK_ACCESS_TOKEN
                    }
                });

                if (response.data && response.data.name) {
                    return response.data.name;
                }
            } catch (error) {
                logger.warn(`Alternative page name fetch failed: ${error.message}`);
            }
            
            // If page ID is numeric, use that directly 
            if (/^\d+$/.test(pageId)) {
                return `Facebook Page (ID: ${pageId})`;
            }
            
            // Last resort, use the page ID as the name
            return pageId;
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
    },

    // Configuration methods
    
    async setChannel(interaction, guildId, channel) {
        if (!fbSettings[guildId]) {
            fbSettings[guildId] = {};
        }
        
        fbSettings[guildId].channelId = channel.id;
        saveSettings();
        
        const reply = {
            embeds: [createEmbed({
                title: 'Facebook Settings',
                description: `Successfully set ${channel} as the Facebook posts channel.`,
                type: 'success'
            })]
        };
        
        if (interaction.reply) {
            if (interaction.deferred) {
                return interaction.editReply(reply);
            } else {
                return interaction.reply(reply);
            }
        } else {
            return interaction.reply(reply);
        }
    },
    
    async setDefaultPage(interaction, guildId, pageIdentifier) {
        const pageId = await this.extractPageId(pageIdentifier);
        
        if (!pageId) {
            const reply = {
                embeds: [createEmbed({
                    title: 'Error',
                    description: 'Invalid Facebook page URL or ID. Please provide a valid Facebook page.',
                    type: 'error'
                })]
            };
            
            if (interaction.reply) {
                if (interaction.deferred) {
                    return interaction.editReply(reply);
                } else {
                    return interaction.reply(reply);
                }
            } else {
                return interaction.reply(reply);
            }
        }
        
        if (!fbSettings[guildId]) {
            fbSettings[guildId] = {};
        }
        
        fbSettings[guildId].defaultPage = pageId;
        saveSettings();
        
        const pageName = await this.getPageName(pageId);
        
        const reply = {
            embeds: [createEmbed({
                title: 'Facebook Settings',
                description: `Successfully set "${pageName}" as the default Facebook page.`,
                type: 'success'
            })]
        };
        
        if (interaction.reply) {
            if (interaction.deferred) {
                return interaction.editReply(reply);
            } else {
                return interaction.reply(reply);
            }
        } else {
            return interaction.reply(reply);
        }
    },
    
    async viewSettings(interaction, guildId) {
        const settings = fbSettings[guildId] || {};
        const channelInfo = settings.channelId 
            ? `<#${settings.channelId}>` 
            : 'No channel set';
        
        let pageInfo = 'No default page set';
        if (settings.defaultPage) {
            try {
                const pageName = await this.getPageName(settings.defaultPage);
                pageInfo = `${pageName} (ID: ${settings.defaultPage})`;
            } catch (error) {
                pageInfo = `Unknown (ID: ${settings.defaultPage})`;
            }
        }
        
        const autopostStatus = settings.autopost 
            ? `Enabled (checking every ${settings.interval || 30} minutes)` 
            : 'Disabled';
        
        const reply = {
            embeds: [createEmbed({
                title: 'Facebook Post Settings',
                description: 'Current settings for Facebook post updates:',
                type: 'info',
                fields: [
                    { name: 'Default Channel', value: channelInfo },
                    { name: 'Default Page', value: pageInfo },
                    { name: 'Auto-posting', value: autopostStatus }
                ]
            })]
        };
        
        if (interaction.reply) {
            if (interaction.deferred) {
                return interaction.editReply(reply);
            } else {
                return interaction.reply(reply);
            }
        } else {
            return interaction.reply(reply);
        }
    },
    
    async toggleAutoPost(interaction, guildId, enabled, interval) {
        if (!fbSettings[guildId]) {
            fbSettings[guildId] = {};
        }
        
        if (enabled) {
            // Check if channel and page are set before enabling
            if (!fbSettings[guildId].channelId) {
                const reply = {
                    embeds: [createEmbed({
                        title: 'Error',
                        description: 'You need to set a channel first before enabling auto-posting.',
                        type: 'error'
                    })]
                };
                
                if (interaction.reply) {
                    if (interaction.deferred) {
                        return interaction.editReply(reply);
                    } else {
                        return interaction.reply(reply);
                    }
                } else {
                    return interaction.reply(reply);
                }
            }
            
            if (!fbSettings[guildId].defaultPage && !process.env.FACEBOOK_DEFAULT_PAGE) {
                const reply = {
                    embeds: [createEmbed({
                        title: 'Error',
                        description: 'You need to set a default Facebook page first before enabling auto-posting.',
                        type: 'error'
                    })]
                };
                
                if (interaction.reply) {
                    if (interaction.deferred) {
                        return interaction.editReply(reply);
                    } else {
                        return interaction.reply(reply);
                    }
                } else {
                    return interaction.reply(reply);
                }
            }
        }
        
        fbSettings[guildId].autopost = enabled;
        fbSettings[guildId].interval = interval;
        fbSettings[guildId].lastPostTime = Date.now();
        saveSettings();
        
        const reply = {
            embeds: [createEmbed({
                title: 'Facebook Auto-posting',
                description: enabled 
                    ? `Auto-posting has been enabled. New posts will be checked every ${interval} minutes.` 
                    : 'Auto-posting has been disabled.',
                type: 'success'
            })]
        };
        
        if (interaction.reply) {
            if (interaction.deferred) {
                return interaction.editReply(reply);
            } else {
                return interaction.reply(reply);
            }
        } else {
            return interaction.reply(reply);
        }
    }
};