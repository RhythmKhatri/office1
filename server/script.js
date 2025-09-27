const fs = require('fs');

setInterval(() => {
    const logMessage = `Log entry at ${new Date().toISOString()}\n`;
    fs.appendFile('server.log', logMessage, (err) => {
        if (err) {
            console.error('Error writing to log file', err);
        }
    });
}, 1000);