const { EmbedBuilder } = require('discord.js');
const config = require('../config');

/**
 * Creates a standardized embed for the bot
 * @param {Object} options - Embed options
 * @param {String} options.title - Embed title
 * @param {String} options.description - Embed description
 * @param {String} options.type - Embed type (success, error, info, warning)
 * @param {Array} options.fields - Embed fields
 * @returns {EmbedBuilder} Discord.js embed
 */
function createEmbed({ title, description, type = 'info', fields = [] }) {
    let color;
    
    switch (type) {
        case 'success':
            color = config.colors.success;
            break;
        case 'error':
            color = config.colors.error;
            break;
        case 'warning':
            color = config.colors.warning;
            break;
        default:
            color = config.colors.primary;
    }
    
    const embed = new EmbedBuilder()
        .setColor(color)
        .setTimestamp();
    
    if (title) embed.setTitle(title);
    if (description) embed.setDescription(description);
    
    if (fields.length > 0) {
        fields.forEach(field => {
            embed.addFields({ 
                name: field.name, 
                value: field.value, 
                inline: field.inline || false 
            });
        });
    }
    
    return embed;
}

module.exports = { createEmbed };