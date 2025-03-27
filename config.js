module.exports = {
    prefix: '!',
    colors: {
        primary: '#5865F2',
        success: '#57F287',
        error: '#ED4245',
        warning: '#FEE75C'
    },
    emojis: {
        success: '✅',
        error: '❌',
        loading: '⏳'
    },
    // Commands that require special authorization beyond normal permissions
    restrictedCommands: [
        'announce',
        'statusset'
    ],
    // Add other configuration properties as needed
};