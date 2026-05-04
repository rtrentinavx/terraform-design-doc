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
          // Exclude Anthropic models — use the Anthropic provider directly
          const filtered = (d.data || []).filter(m => {
            const id = m.id || "";
            return !id.startsWith("anthropic.") && !id.startsWith("openai.") && !id.startsWith("microsoft.") && !id.startsWith("google.");
          });
          if (filtered.length) return res.json({ data: filtered });
        }
      } catch {}
      // Fallback curated list — use when live Mantle fetch is unavailable.
      // Amazon Nova: direct IDs. All others: cross-region inference profile IDs (us. prefix).
      // Anthropic/OpenAI/Google excluded — use their dedicated providers instead.
      return res.json({ data: [
        // Amazon Nova
        { id: "amazon.nova-pro-v1:0",   label: "Amazon Nova Pro" },
        { id: "amazon.nova-lite-v1:0",  label: "Amazon Nova Lite" },
        { id: "amazon.nova-micro-v1:0", label: "Amazon Nova Micro" },
        // Meta Llama 3.x
        { id: "us.meta.llama3-3-70b-instruct-v1:0",  label: "Llama 3.3 70B Instruct" },
        { id: "us.meta.llama3-2-90b-instruct-v1:0",  label: "Llama 3.2 90B Instruct" },
        { id: "us.meta.llama3-2-11b-instruct-v1:0",  label: "Llama 3.2 11B Instruct" },
        { id: "us.meta.llama3-2-3b-instruct-v1:0",   label: "Llama 3.2 3B Instruct" },
        { id: "us.meta.llama3-2-1b-instruct-v1:0",   label: "Llama 3.2 1B Instruct" },
        { id: "us.meta.llama3-1-70b-instruct-v1:0",  label: "Llama 3.1 70B Instruct" },
        { id: "us.meta.llama3-1-8b-instruct-v1:0",   label: "Llama 3.1 8B Instruct" },
        // Mistral
        { id: "us.mistral.mistral-large-2402-v1:0",  label: "Mistral Large" },
        { id: "us.mistral.mistral-small-2402-v1:0",  label: "Mistral Small" },
        { id: "us.mistral.mixtral-8x7b-instruct-v0:1", label: "Mixtral 8x7B Instruct" },
        // Cohere
        { id: "us.cohere.command-r-plus-v1:0", label: "Cohere Command R+" },
        { id: "us.cohere.command-r-v1:0",      label: "Cohere Command R" },
        // AI21
        { id: "us.ai21.jamba-1-5-large-v1:0", label: "AI21 Jamba 1.5 Large" },
        { id: "us.ai21.jamba-1-5-mini-v1:0",  label: "AI21 Jamba 1.5 Mini" },
        // Moonshot Kimi (via Bedrock)
        { id: "moonshotai.kimi-k2-thinking",   label: "Kimi K2 Thinking" },
        { id: "moonshotai.kimi-k2",            label: "Kimi K2" },
        // Writer
        { id: "us.writer.palmyra-x5:0",       label: "Writer Palmyra X5" },
        { id: "us.writer.palmyra-x4:0",       label: "Writer Palmyra X4" },
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
