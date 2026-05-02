import { checkOrigin } from "./_origin.js";

// Supported providers and their endpoint patterns
const buildUrl = (provider, baseUrl, model) => {
  if (provider === "azure") {
    // baseUrl = https://{resource}.openai.azure.com, model = deployment name
    return `${baseUrl}/openai/deployments/${model}/chat/completions?api-version=2024-08-01-preview`;
  }
  if (provider === "gemini") {
    return "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions";
  }
  // custom: caller provides full base URL
  return `${baseUrl.replace(/\/$/, "")}/chat/completions`;
};

const buildHeaders = (provider, apiKey) => {
  if (provider === "azure") {
    return { "Content-Type": "application/json", "api-key": apiKey };
  }
  return { "Content-Type": "application/json", "Authorization": `Bearer ${apiKey}` };
};

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).end();
  if (!checkOrigin(req, res)) return;

  const { provider, baseUrl, apiKey, model, messages, max_tokens, temperature } = req.body;

  if (!apiKey) return res.status(401).json({ error: { message: "Missing apiKey" } });
  if (!provider) return res.status(400).json({ error: { message: "Missing provider" } });

  const url = buildUrl(provider, baseUrl || "", model);
  const headers = buildHeaders(provider, apiKey);

  try {
    const response = await fetch(url, {
      method: "POST",
      headers,
      body: JSON.stringify({ model, messages, max_tokens: max_tokens || 16000, temperature: temperature ?? 0 }),
    });

    const data = await response.json();
    res.status(response.status).json(data);
  } catch (err) {
    res.status(500).json({ error: { message: err.message } });
  }
}
