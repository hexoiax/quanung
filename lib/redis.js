import { createClient } from "redis";

const globalForRedis = globalThis;

let redis;

if (!globalForRedis.redis) {
  redis = createClient({
    url: process.env.REDIS_URL
  });

  redis.on("error", err => {
    console.error("Redis Client Error", err);
  });

  redis.connect();

  globalForRedis.redis = redis;
} else {
  redis = globalForRedis.redis;
}

export { redis };
