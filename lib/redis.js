import { createClient } from "redis";

const globalForRedis = global;

export const redis =
  globalForRedis.redis ||
  createClient({
    url: process.env.REDIS_URL
  });

if (!globalForRedis.redis) {
  globalForRedis.redis = redis;

  redis.on("error", err => {
    console.error("Redis Client Error", err);
  });

  redis.connect();
}
