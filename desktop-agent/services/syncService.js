const fetch = require('node-fetch');
const { getPending, replaceQueue, ensureStore } = require('./localStorage');
const { SYNC_INTERVAL_MS, SYNC_QUEUE_DELAY_MS } = require('../config/appConfig');

let endpoint = null;
let syncTimer = null;
let syncing = false;

const syncPending = async () => {
  if (syncing || !endpoint) return;
  ensureStore();
  const queue = getPending();
  if (!queue.length) return;

  syncing = true;
  const remaining = [];

  // Send logs sequentially to keep the flow simple for the POC.
  // Failures stay in the local queue and will retry on the next pass.
  for (const entry of queue) {
    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(entry),
      });

      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`);
      }
    } catch (err) {
      remaining.push(entry);
    }
  }

  replaceQueue(remaining);
  syncing = false;
};

const init = ({ endpoint: apiEndpoint, intervalMs = SYNC_INTERVAL_MS } = {}) => {
  endpoint = apiEndpoint;
  if (syncTimer) {
    clearInterval(syncTimer);
  }
  syncTimer = setInterval(syncPending, intervalMs);
};

const queueSync = () => {
  setTimeout(syncPending, SYNC_QUEUE_DELAY_MS);
};

const stop = () => {
  if (syncTimer) {
    clearInterval(syncTimer);
    syncTimer = null;
  }
};

module.exports = {
  init,
  queueSync,
  stop,
};

