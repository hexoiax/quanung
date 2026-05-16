import { createClient } from "redis";

const globalForRedis = globalThis;

let redis = globalForRedis.redis;

if (!redis) {
  redis = createClient({
    url: process.env.REDIS_URL
  });

  redis.on("error", err => {
    console.error("Redis Client Error", err);
  });

  await redis.connect();

  globalForRedis.redis = redis;
}

export { redis };
