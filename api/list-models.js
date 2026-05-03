import { checkOrigin } from "./_origin.js";

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).end();
  if (!checkOrigin(req, res)) return;

  const { provider, apiKey, secretKey, baseUrl } = req.body;
  if (!apiKey) return res.status(401).json({ error: "Missing apiKey" });

  try {
    // Bedrock: return well-known model IDs (no public list-models API without SDK)
    if (provider === "bedrock") {
      return res.json({ data: [
        { id: "anthropic.claude-sonnet-4-5" },
        { id: "anthropic.claude-opus-4-5" },
        { id: "anthropic.claude-3-7-sonnet-20250219-v1:0" },
        { id: "anthropic.claude-3-5-sonnet-20241022-v2:0" },
        { id: "anthropic.claude-3-5-haiku-20241022-v1:0" },
        { id: "amazon.nova-pro-v1:0" },
        { id: "amazon.nova-lite-v1:0" },
        { id: "meta.llama3-3-70b-instruct-v1:0" },
        { id: "mistral.mistral-large-2402-v1:0" },
      ]});
    }

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
