const { SlashCommandBuilder } = require('discord.js');
const { createEmbed } = require('../../utils/embedBuilder');
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
            // Simplify the approach - use the page as-is
            const posts = await this.scrapePosts(pageUrl, count);
            
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
            const embeds = posts.map(post => this.createPostEmbed(post));
            
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
            const posts = await this.scrapePosts(pageUrl, count);
            
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
            const embeds = posts.map(post => this.createPostEmbed(post));
            
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
     * Scrape posts from a Facebook page
     * @param {string} url - The Facebook page URL
     * @param {number} count - Number of posts to retrieve
     * @returns {Promise<Array>} - Array of post data
     */
    async scrapePosts(url, count) {
        // Set up a user agent to mimic a regular browser
        const headers = {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
            'Accept-Language': 'en-US,en;q=0.9',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
            'Cache-Control': 'no-cache',
            'Pragma': 'no-cache'
        };
        
        try {
            // Try to use an alternative approach - FBDown
            // This service helps extract public Facebook content
            const fbDownUrl = `https://www.getfbdown.com/search.php?url=${encodeURIComponent(url)}`;
            
            const response = await axios.get(fbDownUrl, { 
                headers,
                maxRedirects: 5,
                timeout: 10000
            });
            
            const $ = cheerio.load(response.data);
            
            // Extract the page name
            const pageName = $('h1').first().text().trim() || url.split('/').pop() || 'Facebook Page';
            
            // Find post containers
            const posts = [];
            const postContainers = $('.card').slice(0, count);
            
            postContainers.each((i, element) => {
                const postElement = $(element);
                
                // Extract post text content
                const postContent = postElement.find('.card-text').text().trim() || 'No text content';
                
                // Extract post date (if available)
                const dateElement = postElement.find('.text-muted').text().trim();
                const postDate = dateElement || 'Recently';
                
                // Extract post URL
                const postUrl = postElement.find('a[href*="facebook.com"]').attr('href') || url;
                
                // Extract image if available
                const imageUrl = postElement.find('img.img-fluid').attr('src') || '';
                
                posts.push({
                    content: postContent,
                    date: postDate,
                    url: postUrl,
                    imageUrl: imageUrl,
                    pageName: pageName
                });
            });
            
            // If we couldn't find posts with the first method, try a fallback
            if (posts.length === 0) {
                // Try a different scraping approach - use a Facebook page scraper service
                const fbScraperUrl = `https://www.facebook.com/pg/${url.split('/').pop()}/posts/`;
                
                const fbResponse = await axios.get(fbScraperUrl, { 
                    headers,
                    maxRedirects: 5,
                    timeout: 10000
                });
                
                const $fb = cheerio.load(fbResponse.data);
                
                // Find post containers
                $fb('.userContentWrapper').slice(0, count).each((i, element) => {
                    const postElement = $fb(element);
                    
                    // Extract post text content
                    const postContent = postElement.find('.userContent').text().trim() || 'No text content';
                    
                    // Extract post date
                    const dateElement = postElement.find('abbr').text().trim();
                    const postDate = dateElement || 'Recently';
                    
                    // Extract post URL
                    const postUrl = postElement.find('a._5pcq').attr('href') || url;
                    
                    // Extract image if available
                    const imageUrl = postElement.find('img.scaledImageFitWidth').attr('src') || '';
                    
                    posts.push({
                        content: postContent,
                        date: postDate,
                        url: postUrl.startsWith('http') ? postUrl : `https://www.facebook.com${postUrl}`,
                        imageUrl: imageUrl,
                        pageName: pageName
                    });
                });
            }
            
            return posts;
        } catch (error) {
            logger.error(`Facebook scraping error: ${error.message}`);
            
            // Try a simpler fallback approach
            try {
                logger.info('Attempting fallback method for Facebook scraping');
                
                // Use a simpler approach - just load the page directly
                const simpleResponse = await axios.get(url, { 
                    headers,
                    maxRedirects: 5,
                    timeout: 10000
                });
                
                const $simple = cheerio.load(simpleResponse.data);
                
                // Extract the page name from title
                const pageName = $simple('title').text().replace(' | Facebook', '') || url.split('/').pop() || 'Facebook Page';
                
                // Create a single dummy post with page info
                return [{
                    content: `This is the Facebook page for ${pageName}. Due to Facebook's privacy settings, individual posts couldn't be retrieved. Please visit the page directly to see posts.`,
                    date: 'Now',
                    url: url,
                    imageUrl: $simple('meta[property="og:image"]').attr('content') || '',
                    pageName: pageName
                }];
            } catch (fallbackError) {
                logger.error(`Facebook fallback scraping error: ${fallbackError.message}`);
                throw new Error('Unable to retrieve Facebook content. Facebook may be blocking automated access.');
            }
        }
    },
    
    /**
     * Create an embed for a Facebook post
     * @param {Object} post - The post data
     * @returns {EmbedBuilder} - Discord embed for the post
     */
    createPostEmbed(post) {
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