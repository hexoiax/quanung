import { createClient } from "redis";

const globalForRedis = globalThis;

if (!process.env.REDIS_URL) {
  throw new Error("Missing REDIS_URL env");
}

let redis = globalForRedis.redisClient;

if (!redis) {
  redis = createClient({
    url: process.env.REDIS_URL,
    socket: {
      reconnectStrategy: retries => {
        if (retries > 5) return false;
        return Math.min(retries * 100, 3000);
      }
    }
  });

  redis.on("error", err => {
    console.error("Redis Client Error:", err);
  });

  redis.on("connect", () => {
    console.log("Redis connecting...");
  });

  redis.on("ready", () => {
    console.log("Redis ready");
  });

  globalForRedis.redisClient = redis;
}

if (!redis.isOpen) {
  await redis.connect();
}

export { redis };
