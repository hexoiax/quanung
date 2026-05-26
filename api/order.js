const GOOGLE_SCRIPT_URL = process.env.GOOGLE_SCRIPT_URL;
const SYNC_SECRET = process.env.SYNC_SECRET;

const SITE_URL = "https://quanung.vercel.app";

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate");

  if (req.method !== "POST") {
    return res.status(405).json({
      status: "error",
      message: "Method Not Allowed"
    });
  }

  try {
    if (!GOOGLE_SCRIPT_URL) {
      throw new Error("Missing GOOGLE_SCRIPT_URL env");
    }

    const payload = await getRequestBody(req);

    if (!payload || typeof payload !== "object") {
      return res.status(400).json({
        status: "error",
        message: "Missing order data"
      });
    }

    const name = cleanText(payload.name);
    const phone = cleanText(payload.phone);
    const address = cleanText(payload.address);
    const size = cleanText(payload.size);

    if (!name || !phone || !address) {
      return res.status(400).json({
        status: "error",
        message: "Missing required fields"
      });
    }

    if (!size) {
      return res.status(400).json({
        status: "error",
        message: "Missing size"
      });
    }

    const quantity = Math.max(1, Number(payload.quantity || 1));

    const orderPayload = {
      name,
      phone,
      address,
      size,
      quantity,
      note: cleanText(payload.note),
      product_name: cleanText(payload.product_name),
      final_price: cleanText(payload.final_price),
      total: Number(payload.total || 0),
      source_url: cleanText(payload.source_url),
      user_agent: cleanText(payload.user_agent),
      source: "vercel_api_order",
      received_at: new Date().toISOString()
    };

    const response = await fetch(GOOGLE_SCRIPT_URL, {
      method: "POST",
      headers: {
        "Content-Type": "text/plain;charset=utf-8"
      },
      body: JSON.stringify(orderPayload)
    });

    const text = await response.text();
    const data = safeJsonParse(text, response.ok);

    if (!response.ok || data.status === "error") {
      return res.status(500).json({
        status: "error",
        message: data.message || "Google Script order failed",
        detail: data
      });
    }

    await syncLandingData();

    return res.status(200).json({
      status: "success",
      message: "Order submitted",
      order_id: data.order_id || null,
      created_at: data.created_at || orderPayload.received_at
    });
  } catch (err) {
    console.error("ORDER API ERROR:", err);

    return res.status(500).json({
      status: "error",
      message: "Cannot submit order",
      error: err.message
    });
  }
}

async function getRequestBody(req) {
  if (!req.body) return null;

  if (typeof req.body === "object") {
    return req.body;
  }

  if (typeof req.body === "string") {
    try {
      return JSON.parse(req.body);
    } catch (err) {
      return null;
    }
  }

  return null;
}

function cleanText(value) {
  return String(value || "").trim();
}

function safeJsonParse(text, isOk) {
  try {
    return JSON.parse(text);
  } catch (err) {
    return {
      status: isOk ? "success" : "error",
      raw: text
    };
  }
}

async function syncLandingData() {
  try {
    if (!SYNC_SECRET) return;

    const url =
      `${SITE_URL}/api/sync-data?secret=${encodeURIComponent(SYNC_SECRET)}`;

    await fetch(url, {
      method: "GET",
      headers: {
        "Cache-Control": "no-cache"
      }
    });
  } catch (err) {
    console.error("AUTO SYNC AFTER ORDER ERROR:", err);
  }
}
