import { redis } from "../lib/redis.js";

const GOOGLE_SCRIPT_URL = process.env.GOOGLE_SCRIPT_URL;

const CACHE_KEY = "LANDING_DATA_V3";
const BACKUP_KEY = "LANDING_DATA_V3_BACKUP";

export default async function handler(req, res) {
  res.setHeader(
    "Cache-Control",
    "s-maxage=120, stale-while-revalidate=300"
  );

  try {
    // 1. Ưu tiên đọc cache chính từ Redis
    const cachedData = await getRedisJson(CACHE_KEY);

    if (cachedData) {
      return res.status(200).json({
        ...cachedData,
        cache_source: "redis_cache"
      });
    }

    // 2. Nếu cache chính rỗng, thử đọc backup
    const backupData = await getRedisJson(BACKUP_KEY);

    if (backupData) {
      return res.status(200).json({
        ...backupData,
        cache_source: "redis_backup"
      });
    }

    // 3. Nếu Redis chưa có data, fallback Apps Script
    const freshData = await fetchFromGoogleScript();

    // 4. Lưu lại Redis cho request sau
    await setRedisJson(CACHE_KEY, freshData);

    return res.status(200).json({
      ...freshData,
      cache_source: "google_script_fallback"
    });

  } catch (err) {
    return res.status(500).json({
      status: "error",
      message: "Cannot load landing data",
      error: err.message
    });
  }
}

async function getRedisJson(key) {
  const raw = await redis.get(key);

  if (!raw) return null;

  if (typeof raw === "object") {
    return raw;
  }

  try {
    return JSON.parse(raw);
  } catch (err) {
    return null;
  }
}

async function setRedisJson(key, value) {
  await redis.set(key, JSON.stringify(value));
}

async function fetchFromGoogleScript() {
  if (!GOOGLE_SCRIPT_URL) {
    throw new Error("Missing GOOGLE_SCRIPT_URL env");
  }

  const response = await fetch(`${GOOGLE_SCRIPT_URL}?route=data`, {
    method: "GET"
  });

  if (!response.ok) {
    throw new Error(`Google Script fetch failed: ${response.status}`);
  }

  const data = await response.json();

  if (!data || data.status !== "success") {
    throw new Error("Invalid Google Script data");
  }

  return data;
}
