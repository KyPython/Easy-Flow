// In-memory store for automation task status/results (for demo/dev only)
// In production, use Redis or a persistent store!
const taskStatusStore = new Map();

module.exports = taskStatusStore;
