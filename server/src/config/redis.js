const Redis = require("ioredis");

const redis = new Redis(process.env.REDIS_URL || "redis://localhost:6379", {
  maxRetriesPerRequest: null,
});

redis.on("error", (error) => {
  console.error("Redis connection error:", error);
});

module.exports = redis;
