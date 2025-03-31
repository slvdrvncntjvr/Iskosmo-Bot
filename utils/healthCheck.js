const http = require('http');
const logger = require('./logger');
const killSwitch = require('./killSwitch');

function startHealthServer(port = 3000) {
    const server = http.createServer((req, res) => {
        if (req.url === '/health') {
            const status = {
                status: 'online',
                killed: killSwitch.isKilled(),
                uptime: process.uptime(),
                timestamp: new Date().toISOString()
            };
            
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify(status));
        } else {
            res.writeHead(404);
            res.end();
        }
    });
    
    server.listen(port, () => {
        logger.info(`Health check server running on port ${port}`);
    });
    
    server.on('error', (err) => {
        logger.error('Health check server error:', err);
    });
    
    return server;
}

module.exports = { startHealthServer };