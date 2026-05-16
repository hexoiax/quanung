const GOOGLE_SCRIPT_URL = process.env.GOOGLE_SCRIPT_URL;

export default async function handler(req, res) {
  // Chỉ cho phép POST
  if (req.method !== "POST") {
    return res.status(405).json({
      status: "error",
      message: "Method not allowed"
    });
  }

  try {
    const payload = req.body;

    // Validate cơ bản
    if (!payload) {
      return res.status(400).json({
        status: "error",
        message: "Missing order data"
      });
    }

    if (!payload.name || !payload.phone || !payload.address) {
      return res.status(400).json({
        status: "error",
        message: "Missing required fields"
      });
    }

    if (!payload.size) {
      return res.status(400).json({
        status: "error",
        message: "Missing size"
      });
    }

    const orderPayload = {
      ...payload,
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

    let data;

    try {
      data = JSON.parse(text);
    } catch (err) {
      data = {
        status: response.ok ? "success" : "error",
        raw: text
      };
    }

    if (!response.ok || data.status === "error") {
      return res.status(500).json({
        status: "error",
        message: data.message || "Google Script order failed",
        detail: data
      });
    }

    return res.status(200).json({
      status: "success",
      message: "Order submitted",
      order_id: data.order_id || null,
      created_at: data.created_at || orderPayload.received_at
    });

  } catch (err) {
    return res.status(500).json({
      status: "error",
      message: "Cannot submit order",
      error: err.message
    });
  }
}
