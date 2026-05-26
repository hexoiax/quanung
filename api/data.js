import { redis } from "../lib/redis.js";

const GOOGLE_SCRIPT_URL = process.env.GOOGLE_SCRIPT_URL;

const CACHE_KEY = "LANDING_DATA_V3";
const BACKUP_KEY = "LANDING_DATA_V3_BACKUP";

export default async function handler(req, res) {
  res.setHeader(
    "Cache-Control",
    "s-maxage=120, stale-while-revalidate=300"
  );

  if (req.method !== "GET") {
    return res.status(405).json({
      status: "error",
      message: "Method Not Allowed"
    });
  }

  try {
    const cachedData = await getRedisJson(CACHE_KEY);

    if (cachedData) {
      return res.status(200).json({
        ...cachedData,
        cache_source: "redis_cache"
      });
    }

    const backupData = await getRedisJson(BACKUP_KEY);

    if (backupData) {
      return res.status(200).json({
        ...backupData,
        cache_source: "redis_backup"
      });
    }

    const freshData = await fetchFromGoogleScript();

    await setRedisJson(CACHE_KEY, {
      ...freshData,
      cache_source: "google_script_fallback",
      synced_at: new Date().toISOString()
    });

    return res.status(200).json({
      ...freshData,
      cache_source: "google_script_fallback"
    });
  } catch (err) {
    console.error("DATA API ERROR:", err);

    return res.status(500).json({
      status: "error",
      message: "Cannot load landing data",
      error: err.message
    });
  }
}

async function getRedisJson(key) {
  try {
    const raw = await redis.get(key);

    if (!raw) return null;

    if (typeof raw === "object") {
      return raw;
    }

    return JSON.parse(raw);
  } catch (err) {
    console.error(`REDIS GET ERROR ${key}:`, err);
    return null;
  }
}

async function setRedisJson(key, value) {
  try {
    await redis.set(key, JSON.stringify(value));
  } catch (err) {
    console.error(`REDIS SET ERROR ${key}:`, err);
  }
}

async function fetchFromGoogleScript() {
  if (!GOOGLE_SCRIPT_URL) {
    throw new Error("Missing GOOGLE_SCRIPT_URL env");
  }

  const url = `${GOOGLE_SCRIPT_URL}?route=data&t=${Date.now()}`;

  const response = await fetch(url, {
    method: "GET",
    headers: {
      "Accept": "application/json"
    }
  });

  const text = await response.text();

  if (!response.ok) {
    throw new Error(`Google Script fetch failed: ${response.status} - ${text}`);
  }

  let data;

  try {
    data = JSON.parse(text);
  } catch (err) {
    throw new Error("Google Script returned invalid JSON: " + text.slice(0, 300));
  }

  if (!data || data.status !== "success") {
    throw new Error("Invalid Google Script data: " + JSON.stringify(data).slice(0, 300));
  }

  return data;
}
