import { redis } from "../lib/redis.js";

const GOOGLE_SCRIPT_URL = process.env.GOOGLE_SCRIPT_URL;
const SYNC_SECRET = process.env.SYNC_SECRET;

const CACHE_KEY = "LANDING_DATA_V3";
const BACKUP_KEY = "LANDING_DATA_V3_BACKUP";

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate");

  if (req.method !== "GET" && req.method !== "POST") {
    return res.status(405).json({
      status: "error",
      message: "Method Not Allowed"
    });
  }

  try {
    const secret =
      req.headers["x-sync-secret"] ||
      req.headers["authorization"]?.replace("Bearer ", "") ||
      req.query.secret;

    if (SYNC_SECRET && secret !== SYNC_SECRET) {
      return res.status(401).json({
        status: "error",
        message: "Unauthorized"
      });
    }

    const freshData = await fetchFromGoogleScript();

    const payload = {
      ...freshData,
      cache_source: "redis_apps_script_sync",
      synced_at: new Date().toISOString()
    };

    const oldData = await getRedisJson(CACHE_KEY);

    if (oldData) {
      await setRedisJson(BACKUP_KEY, oldData);
    }

    await setRedisJson(CACHE_KEY, payload);

    return res.status(200).json({
      status: "success",
      message: "Landing data synced",
      cache_source: payload.cache_source,
      source_updated_at: freshData.updated_at || null,
      synced_at: payload.synced_at,
      cache_key: CACHE_KEY,
      backup_key: BACKUP_KEY
    });
  } catch (err) {
    console.error("SYNC DATA ERROR:", err);

    return res.status(500).json({
      status: "error",
      message: "Sync failed",
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
