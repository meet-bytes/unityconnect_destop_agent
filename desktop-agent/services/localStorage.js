const fs = require("fs");
const path = require("path");
const { app } = require("electron");

let cachedPath = null;

const resolveStorePath = () => {
  if (cachedPath) return cachedPath;
  // In a packaged app the asar is read-only; store under userData.
  const baseDir =
    (app && app.getPath ? app.getPath("userData") : null) ||
    path.join(__dirname, "..", "storage");

  if (!fs.existsSync(baseDir)) {
    fs.mkdirSync(baseDir, { recursive: true });
  }

  cachedPath = path.join(baseDir, "idleLogs.json");
  return cachedPath;
};

const ensureStore = () => {
  const storePath = resolveStorePath();
  if (!fs.existsSync(storePath)) {
    fs.writeFileSync(
      storePath,
      JSON.stringify({ queue: [], archive: [] }, null, 2),
      "utf-8",
    );
  }
};

const readStore = () => {
  ensureStore();
  const storePath = resolveStorePath();
  const raw = fs.readFileSync(storePath, "utf-8");
  return JSON.parse(raw || '{"queue":[],"archive":[]}');
};

const writeStore = (data) => {
  ensureStore();
  const storePath = resolveStorePath();
  fs.writeFileSync(storePath, JSON.stringify(data, null, 2), "utf-8");
};

const appendLog = (log) => {
  const data = readStore();
  data.queue.push(log);
  data.archive.push(log);
  writeStore(data);
};

const getPending = () => readStore().queue;

const getArchive = () => readStore().archive;

const replaceQueue = (queue) => {
  const data = readStore();
  data.queue = queue;
  writeStore(data);
};

const clearAll = () => {
  writeStore({ queue: [], archive: [] });
};

module.exports = {
  storePath: () => resolveStorePath(),
  ensureStore,
  appendLog,
  getPending,
  getArchive,
  replaceQueue,
  readStore,
  clearAll,
};
