const fs = require("fs");
const path = require("path");
const { app } = require("electron");

let protocolQueuePath = null;

const getProtocolQueuePath = () => {
  if (protocolQueuePath) return protocolQueuePath;
  const baseDir =
    (app && app.getPath ? app.getPath("userData") : null) ||
    path.join(__dirname, "..", "storage");
  if (!fs.existsSync(baseDir)) {
    fs.mkdirSync(baseDir, { recursive: true });
  }
  protocolQueuePath = path.join(baseDir, "protocol-queue.json");
  return protocolQueuePath;
};

/**
 * Read and clear protocol URL from queue (called by main app)
 */
const dequeueProtocolURL = () => {
  try {
    const queuePath = getProtocolQueuePath();
    if (!fs.existsSync(queuePath)) return null;
    
    let content;
    try {
      content = fs.readFileSync(queuePath, "utf-8");
      fs.unlinkSync(queuePath);
    } catch (err) {
      return null;
    }
    
    const queue = JSON.parse(content);
    if (Date.now() - queue.timestamp < 10000) {
      return queue.url;
    }
    return null;
  } catch (err) {
    return null;
  }
};

module.exports = {
  dequeueProtocolURL,
};
