// server.js
const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const fs = require('fs').promises;
const fsSync = require('fs'); // Only for statSync
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

const BUFFER_SIZE = 1024;
const LOG_FILE_PATH = path.resolve(__dirname, 'server.log');
console.log('Log file path:', LOG_FILE_PATH, __dirname);
// Read chunk between offsets using async fs.promises
async function readChunk(filePath, start, end) {
  if (start >= end) throw new Error('Invalid offsets for readChunk');
  const length = end - start;
  const fd = await fs.open(filePath, 'r');
  try {
    const buffer = Buffer.alloc(length);
    await fd.read(buffer, 0, length, start);
    return buffer.toString();
  } finally {
    await fd.close();
  }
}

// Read last N lines efficiently from file end
async function getLastNLines(filePath, n) {
  const stats = await fs.stat(filePath);
  let offset = stats.size;
  let lineCount = 0;
  let content = '';

  while (offset > 0 && lineCount <= n) {
    const readStart = Math.max(0, offset - BUFFER_SIZE);
    const chunk = await readChunk(filePath, readStart, offset);
    content = chunk + content;
    lineCount = (content.match(/\n/g) || []).length;
    offset = readStart;
  }

  const lines = content.trim().split('\n');
  return lines.slice(-n).join('\n');
}

let lastFileSize = 0;

io.on('connection', async (socket) => {
  console.log('Client connected:', socket.id);

  const lastLines = await getLastNLines(LOG_FILE_PATH, 10);
  socket.emit('fileEvent', lastLines);

  const stats = await fs.stat(LOG_FILE_PATH);
  lastFileSize = stats.size;
});

// Watch file using fs.watch, and read incremental appended data
fsSync.watch(LOG_FILE_PATH, async (eventType) => {
  if (eventType === 'change') {
    try {
      const stats = await fs.stat(LOG_FILE_PATH);
      if (stats.size > lastFileSize) {
        const newContent = await readChunk(LOG_FILE_PATH, lastFileSize, stats.size);
        lastFileSize = stats.size;

        const newLines = newContent.trim().split('\n').filter(line => line.length > 0);
        const message = newLines.join('\n');

        io.emit('fileEvent', message);
      }
    } catch (err) {
      console.error('Error reading appended data:', err);
    }
  }
});

app.get('/log', (req, res) => {
  // console.log(path.resolve(__dirname, '..','client', 'index.html'));
  res.sendFile(path.resolve(__dirname, '..','client', 'index.html'));
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}/log`);
});
