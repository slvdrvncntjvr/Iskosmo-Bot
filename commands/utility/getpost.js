const { SlashCommandBuilder } = require('discord.js');
const { createEmbed } = require('../../utils/embedBuilder');
const { getRandomMobileUserAgent } = require('../../utils/userAgents');
const axios = require('axios');
const cheerio = require('cheerio');
const logger = require('../../utils/logger');

module.exports = {
    name: 'getpost',
    description: 'Get the latest posts from a Facebook page',
    usage: '<facebook_page_url> [number_of_posts]',
    category: 'utility',
    
    // Slash command definition
    slashCommand: new SlashCommandBuilder()
        .setName('getpost')
        .setDescription('Get the latest posts from a Facebook page')
        .addStringOption(option => 
            option.setName('page')
                .setDescription('Facebook page URL')
                .setRequired(true))
        .addIntegerOption(option => 
            option.setName('count')
                .setDescription('Number of posts to retrieve (default: 1, max: 3)')
                .setMinValue(1)
                .setMaxValue(3)
                .setRequired(false)),
    
    async execute(message, args, client) {
        if (!args.length) {
            return message.reply({
                embeds: [createEmbed({
                    title: 'Error',
                    description: `You need to provide a Facebook page URL. Usage: \`!${this.name} ${this.usage}\``,
                    type: 'error'
                })]
            });
        }
        
        const pageUrl = args[0];
        let count = 1;
        
        if (args.length > 1 && !isNaN(args[1])) {
            count = parseInt(args[1]);
            if (count < 1) count = 1;
            if (count > 3) count = 3; // Limit to 3 to prevent abuse
        }
        
        // Validate the URL is a Facebook page
        if (!this.isValidFacebookUrl(pageUrl)) {
            return message.reply({
                embeds: [createEmbed({
                    title: 'Error',
                    description: 'Please provide a valid Facebook page URL (e.g., https://www.facebook.com/meta).',
                    type: 'error'
                })]
            });
        }
        
        // Show loading message
        const loadingMessage = await message.reply({
            embeds: [createEmbed({
                title: 'Loading...',
                description: 'Fetching Facebook posts, please wait...',
                type: 'info'
            })]
        });
        
        try {
            // Get the mobile version of the page which is easier to scrape
            const mobileUrl = this.convertToMobileUrl(pageUrl);
            const posts = await this.scrapePosts(mobileUrl, count);
            
            if (!posts || posts.length === 0) {
                return loadingMessage.edit({
                    embeds: [createEmbed({
                        title: 'No Posts Found',
                        description: 'No posts were found on this Facebook page, or the page might be private.',
                        type: 'warning'
                    })]
                });
            }
            
            // Create embeds for each post
            const embeds = posts.map(post => this.createPostEmbed(post, mobileUrl));
            
            // Edit the loading message with the first embed
            await loadingMessage.edit({ embeds: [embeds[0]] });
            
            // Send additional embeds if there are more posts
            for (let i = 1; i < embeds.length; i++) {
                await message.channel.send({ embeds: [embeds[i]] });
            }
            
        } catch (error) {
            logger.error(`Error in getpost command: ${error.message}`);
            loadingMessage.edit({
                embeds: [createEmbed({
                    title: 'Error',
                    description: 'An error occurred while fetching Facebook posts. This could be due to a private page or Facebook blocking the request.',
                    type: 'error'
                })]
            });
        }
    },
    
    async executeSlash(interaction, client) {
        await interaction.deferReply();
        
        const pageUrl = interaction.options.getString('page');
        const count = interaction.options.getInteger('count') || 1;
        
        // Validate the URL is a Facebook page
        if (!this.isValidFacebookUrl(pageUrl)) {
            return interaction.editReply({
                embeds: [createEmbed({
                    title: 'Error',
                    description: 'Please provide a valid Facebook page URL (e.g., https://www.facebook.com/meta).',
                    type: 'error'
                })]
            });
        }
        
        try {
            // Get the mobile version of the page which is easier to scrape
            const mobileUrl = this.convertToMobileUrl(pageUrl);
            const posts = await this.scrapePosts(mobileUrl, count);
            
            if (!posts || posts.length === 0) {
                return interaction.editReply({
                    embeds: [createEmbed({
                        title: 'No Posts Found',
                        description: 'No posts were found on this Facebook page, or the page might be private.',
                        type: 'warning'
                    })]
                });
            }
            
            // Create embeds for each post
            const embeds = posts.map(post => this.createPostEmbed(post, mobileUrl));
            
            // Edit the deferred reply with the first embed
            await interaction.editReply({ embeds: [embeds[0]] });
            
            // Send additional embeds if there are more posts
            for (let i = 1; i < embeds.length; i++) {
                await interaction.followUp({ embeds: [embeds[i]] });
            }
            
        } catch (error) {
            logger.error(`Error in getpost slash command: ${error.message}`);
            interaction.editReply({
                embeds: [createEmbed({
                    title: 'Error',
                    description: 'An error occurred while fetching Facebook posts. This could be due to a private page or Facebook blocking the request.',
                    type: 'error'
                })]
            });
        }
    },
    
    /**
     * Check if a URL is a valid Facebook page URL
     * @param {string} url - The URL to check
     * @returns {boolean} - Whether the URL is valid
     */
    isValidFacebookUrl(url) {
        try {
            const parsedUrl = new URL(url);
            return parsedUrl.hostname.includes('facebook.com') || 
                   parsedUrl.hostname.includes('fb.com');
        } catch (error) {
            return false;
        }
    },
    
    /**
     * Convert a Facebook URL to its mobile version
     * @param {string} url - The Facebook URL
     * @returns {string} - The mobile version of the URL
     */
    convertToMobileUrl(url) {
        try {
            const parsedUrl = new URL(url);
            
            // Replace the hostname with the mobile version
            if (parsedUrl.hostname === 'www.facebook.com') {
                parsedUrl.hostname = 'm.facebook.com';
            } else if (parsedUrl.hostname === 'facebook.com') {
                parsedUrl.hostname = 'm.facebook.com';
            } else if (parsedUrl.hostname === 'www.fb.com') {
                parsedUrl.hostname = 'm.facebook.com';
                // Convert the path if it's a short URL
                if (parsedUrl.pathname.length <= 2) {
                    // This is a guess, we'd need to follow redirects to be sure
                    parsedUrl.pathname = `/${parsedUrl.pathname.substring(1)}`;
                }
            }
            
            return parsedUrl.toString();
        } catch (error) {
            // If parsing fails, just replace www with m
            return url.replace('www.facebook.com', 'm.facebook.com')
                      .replace('facebook.com', 'm.facebook.com');
        }
    },
    
    /**
     * Scrape posts from a Facebook page
     * @param {string} url - The mobile Facebook page URL
     * @param {number} count - Number of posts to retrieve
     * @returns {Promise<Array>} - Array of post data
     */
    async scrapePosts(url, count) {
        // Set up a user agent to mimic a mobile browser
        const headers = {
            'User-Agent': getRandomMobileUserAgent(),
            'Accept-Language': 'en-US,en;q=0.9',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
            'Cache-Control': 'no-cache',
            'Pragma': 'no-cache'
        };
        
        const response = await axios.get(url, { headers });
        const $ = cheerio.load(response.data);
        
        // Extract the page name
        const pageName = $('title').text().replace(' | Facebook', '');
        
        // Find post articles
        const posts = [];
        const postElements = $('article').slice(0, count);
        
        postElements.each((i, element) => {
            const postElement = $(element);
            
            // Extract post text content
            let postContent = '';
            postElement.find('div[data-gt]').each((i, div) => {
                if ($(div).find('img, video').length === 0) {
                    const text = $(div).text().trim();
                    if (text && text.length > postContent.length) {
                        postContent = text;
                    }
                }
            });
            
            // If we still don't have content, try other selectors
            if (!postContent) {
                postElement.find('p').each((i, p) => {
                    const text = $(p).text().trim();
                    if (text) {
                        postContent += text + '\n';
                    }
                });
            }
            
            // Extract post date
            const dateElement = postElement.find('abbr');
            const postDate = dateElement.text() || 'Unknown date';
            
            // Extract post URL
            let postUrl = '';
            postElement.find('a').each((i, a) => {
                const href = $(a).attr('href');
                if (href && href.includes('/story.php')) {
                    postUrl = 'https://m.facebook.com' + href;
                    return false; // break the loop
                }
            });
            
            // Extract image if available
            let imageUrl = '';
            postElement.find('img').each((i, img) => {
                const src = $(img).attr('src');
                // Skip small icons and profile pictures
                if (src && !src.includes('emoji') && !src.includes('profile')) {
                    imageUrl = src;
                    return false; // break the loop
                }
            });
            
            posts.push({
                content: postContent.trim() || 'No text content',
                date: postDate,
                url: postUrl || url, // Use the post URL if found, otherwise use page URL
                imageUrl: imageUrl,
                pageName: pageName
            });
        });
        
        return posts;
    },
    
    /**
     * Create an embed for a Facebook post
     * @param {Object} post - The post data
     * @param {string} pageUrl - The URL of the Facebook page
     * @returns {EmbedBuilder} - Discord embed for the post
     */
    createPostEmbed(post, pageUrl) {
        // Truncate content if it's too long
        const content = post.content.length > 4000 
            ? post.content.substring(0, 4000) + '...' 
            : post.content;
        
        // Create embed
        const embedOptions = {
            title: `Post from ${post.pageName}`,
            description: content,
            type: 'info',
            fields: [
                { name: 'Posted', value: post.date }
            ]
        };
        
        if (post.url) {
            embedOptions.fields.push({ name: 'Link', value: post.url });
        }
        
        const embed = createEmbed(embedOptions);
        
        // Add image if available
        if (post.imageUrl) {
            embed.setImage(post.imageUrl);
        }
        
        // Add page URL as footer
        embed.setFooter({ text: `Facebook Page: ${post.pageName}` });
        
        return embed;
    }
};