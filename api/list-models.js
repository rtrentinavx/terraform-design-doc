import { checkOrigin } from "./_origin.js";

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).end();
  if (!checkOrigin(req, res)) return;

  const { provider, apiKey, baseUrl } = req.body;
  if (!apiKey) return res.status(401).json({ error: "Missing apiKey" });

  try {
    let url, headers;

    if (provider === "anthropic") {
      url = "https://api.anthropic.com/v1/models";
      headers = { "x-api-key": apiKey, "anthropic-version": "2023-06-01" };
    } else if (provider === "gemini") {
      url = `https://generativelanguage.googleapis.com/v1beta/openai/models`;
      headers = { "Authorization": `Bearer ${apiKey}` };
    } else if (provider === "azure") {
      url = `${baseUrl}/openai/models?api-version=2024-08-01-preview`;
      headers = { "api-key": apiKey };
    } else {
      // Custom OpenAI-compatible
      url = `${(baseUrl || "").replace(/\/$/, "")}/models`;
      headers = { "Authorization": `Bearer ${apiKey}` };
    }

    const response = await fetch(url, { headers });
    const data = await response.json();
    res.status(response.status).json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}
