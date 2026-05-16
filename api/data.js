import { kv } from "@vercel/kv";

const GOOGLE_SCRIPT_URL = process.env.GOOGLE_SCRIPT_URL;
const CACHE_KEY = "LANDING_DATA_V3";

export default async function handler(req, res) {
  res.setHeader(
    "Cache-Control",
    "s-maxage=120, stale-while-revalidate=300"
  );

  try {
    // 1. Ưu tiên đọc từ KV cache
    const cachedData = await kv.get(CACHE_KEY);

    if (cachedData) {
      return res.status(200).json({
        ...cachedData,
        cache_source: "vercel_kv"
      });
    }

    // 2. Nếu KV chưa có data thì fallback Apps Script
    const freshData = await fetchFromGoogleScript();

    // 3. Lưu lại KV để request sau nhanh hơn
    await kv.set(CACHE_KEY, freshData);

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

async function fetchFromGoogleScript() {
  if (!GOOGLE_SCRIPT_URL) {
    throw new Error("Missing GOOGLE_SCRIPT_URL env");
  }

  const response = await fetch(`${GOOGLE_SCRIPT_URL}?route=data`, {
    method: "GET"
  });

  if (!response.ok) {
    throw new Error("Google Script fetch failed");
  }

  const data = await response.json();

  if (!data || data.status !== "success") {
    throw new Error("Invalid Google Script data");
  }

  return data;
}
