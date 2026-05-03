import { checkOrigin } from "./_origin.js";

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).end();
  if (!checkOrigin(req, res)) return;

  const { provider, apiKey, secretKey, baseUrl } = req.body;
  if (!apiKey) return res.status(401).json({ error: "Missing apiKey" });

  try {
    // Bedrock: use Mantle OpenAI-compatible /v1/models endpoint (accepts Bearer token)
    // Falls back to curated list if the live fetch fails or region not provided
    if (provider === "bedrock") {
      const region = baseUrl || "us-east-1";
      try {
        const mantleUrl = `https://bedrock-mantle.${region}.api.aws/v1/models`;
        const r = await fetch(mantleUrl, {
          headers: { "Authorization": `Bearer ${apiKey}` },
          signal: AbortSignal.timeout(5000),
        });
        if (r.ok) {
          const d = await r.json();
          if (d.data?.length) return res.json(d);
        }
      } catch {}
      // Fallback: curated list of commonly available models
      return res.json({ data: [
        { id: "anthropic.claude-sonnet-4-5" },
        { id: "anthropic.claude-opus-4-5" },
        { id: "anthropic.claude-3-7-sonnet-20250219-v1:0" },
        { id: "anthropic.claude-3-5-sonnet-20241022-v2:0" },
        { id: "anthropic.claude-3-5-haiku-20241022-v1:0" },
        { id: "amazon.nova-pro-v1:0" },
        { id: "amazon.nova-lite-v1:0" },
        { id: "amazon.nova-micro-v1:0" },
        { id: "meta.llama3-3-70b-instruct-v1:0" },
        { id: "meta.llama3-1-8b-instruct-v1:0" },
        { id: "mistral.mistral-large-2402-v1:0" },
        { id: "cohere.command-r-plus-v1:0" },
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
