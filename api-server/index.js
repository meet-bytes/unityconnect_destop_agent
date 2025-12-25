const express = require('express');
const fs = require('fs');
const path = require('path');
const idleLogsRouter = require('./routes/idleLogs');
const cors = require('cors');
const app = express();
const PORT = 9065;
const logsDir = path.join(__dirname, 'logs');

if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir, { recursive: true });
}

app.use(express.json());
app.use('/api/idle-logs', idleLogsRouter);
// need to allow for all the origins
app.use(cors({
  origin: '*',
}));

app.get('/', (_req, res) => {
  res.send('Idle Agent API server is running.');
});

app.listen(PORT, () => {
  console.log(`API server listening on http://localhost:${PORT}`);
});

