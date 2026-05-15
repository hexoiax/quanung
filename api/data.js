const GOOGLE_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbyK0q0aINBGfBz3XR6Pwzfv9hacos0azkAg7m3zu4xMhRWHu3oGYSAK7PG7M64qkJGxHA/exec";

export default async function handler(req, res) {
  try {
    res.setHeader(
      "Cache-Control",
      "s-maxage=120, stale-while-revalidate=300"
    );

    const response = await fetch(GOOGLE_SCRIPT_URL);
    const data = await response.json();

    res.status(200).json(data);
  } catch (err) {
    res.status(500).json({
      status: "error",
      message: "Cannot load landing data"
    });
  }
}
