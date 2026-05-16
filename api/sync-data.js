import { kv } from "@vercel/kv";

const GOOGLE_SCRIPT_URL = process.env.GOOGLE_SCRIPT_URL;
const SYNC_SECRET = process.env.SYNC_SECRET;

const CACHE_KEY = "LANDING_DATA_V3";
const BACKUP_KEY = "LANDING_DATA_V3_BACKUP";

export default async function handler(req, res) {
  try {
    // Bảo vệ API sync, tránh người ngoài gọi bậy
    const secret = req.headers["x-sync-secret"] || req.query.secret;

    if (SYNC_SECRET && secret !== SYNC_SECRET) {
      return res.status(401).json({
        status: "error",
        message: "Unauthorized"
      });
    }

    const freshData = await fetchFromGoogleScript();

    const payload = {
      ...freshData,
      cache_source: "vercel_cron_sync",
      synced_at: new Date().toISOString()
    };

    // Backup data cũ trước khi ghi data mới
    const oldData = await kv.get(CACHE_KEY);

    if (oldData) {
      await kv.set(BACKUP_KEY, oldData);
    }

    // Ghi data mới vào KV
    await kv.set(CACHE_KEY, payload);

    return res.status(200).json({
      status: "success",
      message: "Landing data synced",
      synced_at: payload.synced_at,
      cache_key: CACHE_KEY
    });

  } catch (err) {
    return res.status(500).json({
      status: "error",
      message: "Sync failed",
      error: err.message
    });
  }
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
