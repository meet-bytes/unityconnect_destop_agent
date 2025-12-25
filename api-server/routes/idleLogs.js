const express = require('express');
const fs = require('fs');
const path = require('path');

const router = express.Router();
const logFile = path.join(__dirname, '..', 'logs', 'idle-logs.jsonl');

const persistLog = (entry) => {
  fs.appendFileSync(logFile, JSON.stringify(entry) + '\n', 'utf-8');
};

const getClientIp = (req) => {
  const fwd = req.headers['x-forwarded-for'];
  if (typeof fwd === 'string' && fwd.length) {
    return fwd.split(',')[0].trim();
  }
  return req.ip || req.socket?.remoteAddress || 'unknown';
};

router.post('/', (req, res) => {
  const { userName, idleStart, idleEnd, durationInSeconds, platform } =
    req.body || {};

  if (!userName || !idleStart || !idleEnd || !durationInSeconds || !platform) {
    return res.status(400).json({
      message:
        'Invalid payload. Required: userName, idleStart, idleEnd, durationInSeconds, platform.',
    });
  }

  const record = {
    userName,
    idleStart,
    idleEnd,
    durationInSeconds: Number(durationInSeconds),
    platform,
    clientIp: getClientIp(req),
    receivedAt: new Date().toISOString(),
  };

  console.log('Received idle log:', record);

  try {
    persistLog(record);
  } catch (err) {
    console.error('Failed to persist idle log', err);
  }

  return res.json({ ok: true });
});

module.exports = router;

