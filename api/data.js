const GOOGLE_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbyd7eV9VF0rgWkOpD-GciwtENOQF6TjQAZUYREFXWH4yYUQPM3amgKb3u_sjr_-VT2mqA/exec";

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
