import { generateText } from "ai";
import { createAnthropic } from "@ai-sdk/anthropic";
import { createOpenAI } from "@ai-sdk/openai";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { createAmazonBedrock } from "@ai-sdk/amazon-bedrock";
import { initSentry, Sentry } from "./_sentry.js";
import { checkOrigin } from "./_origin.js";

const TEXT_PROVIDERS = new Set(["anthropic", "bedrock", "custom"]);

const DCF_PROMPT = `You are an Aviatrix Distributed Cloud Firewall (DCF) expert. Given Terraform code and a network summary, generate a complete DCF policy recommendation.

Return a JSON object with two fields:
{
  "dcf_config": {
    "smart_groups": [{"name":"string","description":"string","cidr":"string","members":["string"]}],
    "web_groups": [{"name":"string","description":"string","domains":["string"]}],
    "rulesets": [{
      "name":"string","description":"string",
      "rules":[{
        "name":"string","priority":1,
        "src":"smart_group_name","dst":"smart_group_name_or_web_group_name",
        "protocol":"Any|TCP|UDP|ICMP","port":"Any|443|80|etc",
        "action":"PERMIT|DENY","logging":true,
        "description":"why this rule exists"
      }]
    }]
  },
  "terraform_code": "string (complete HCL code for the DCF configuration)"
}

SmartGroup guidelines:
- Create one SmartGroup per spoke VPC using its CIDR
- Create a SmartGroup for the transit/management network
- Create an "any-internal" group covering all RFC1918 space
- Use descriptive names matching the VPC/environment names

WebGroup guidelines:
- Create groups for common destinations: software updates, monitoring, cloud APIs
- Create a group for corporate-specific destinations if identifiable from resource names

Ruleset guidelines:
- Default deny-all at the end
- Allow spoke-to-spoke where appropriate (or deny for Zero Trust)
- Allow egress to WebGroups for internet-bound traffic via transit
- Allow ICMP for network troubleshooting
- Log all DENY rules, log PERMIT rules for sensitive segments

Terraform code guidelines:
- Generate aviatrix_smart_group resources for each SmartGroup
- Generate aviatrix_web_group resources for each WebGroup
- Generate aviatrix_distributed_firewalling_policy_list with all rules
- Generate aviatrix_distributed_firewalling_config to enable DCF
- Use resource name references (not hardcoded UUIDs)
- Add comments explaining each section
- Mark it clearly as TENTATIVE/REVIEW REQUIRED

Return ONLY valid JSON. No markdown fences.`;

function buildModel(provider: string, apiKey: string, model: string, baseUrl?: string) {
  if (provider === "anthropic") return createAnthropic({ apiKey })(model);
  if (provider === "bedrock") return createOpenAI({ apiKey, baseURL: `https://bedrock-mantle.${baseUrl||"us-east-1"}.api.aws/v1`, compatibility: "compatible" })(model);
  if (provider === "gemini") return createGoogleGenerativeAI({ apiKey })(model);
  if (provider === "azure") return createOpenAI({ apiKey, baseURL: `${baseUrl}/openai/deployments/${model}`, compatibility: "compatible" })(model);
  return createOpenAI({ apiKey, baseURL: baseUrl, compatibility: "compatible" })(model, { simulateStreaming: false });
}

export default async function handler(req: any, res: any) {
  if (req.method !== "POST") return res.status(405).end();
  if (!checkOrigin(req, res)) return;

  const { provider = "anthropic", apiKey, model, baseUrl, tfContent, hldSummary, enableEgress = true, temperature } = req.body;
  if (!apiKey) return res.status(401).json({ error: "Missing apiKey" });

  const bodySize = JSON.stringify(req.body).length;
  if (bodySize > 5 * 1024 * 1024) return res.status(413).json({ error: "Request too large (max 5 MB)" });

  try {
    initSentry();
    const mdl = buildModel(provider, apiKey, model, baseUrl);
    const egressNote = enableEgress
      ? "Include egress rules to WebGroups for internet-bound traffic (software updates, monitoring, cloud APIs)."
      : "DO NOT include any egress rules or internet access. Implement Zero Trust — all traffic not explicitly allowed is denied.";
    const prompt = `NETWORK SUMMARY FROM HLD:\n${JSON.stringify(hldSummary, null, 2)}\n\nEGRESS POLICY: ${egressNote}\n\nTERRAFORM CODE:\n${tfContent}`;

    const { text } = await generateText({
      model: mdl,
      system: DCF_PROMPT,
      prompt,
      temperature: 0,
      maxTokens: 8000,
    });

    const raw = text.replace(/```json|```/g, "").trim();
    let parsed: any;
    try { parsed = JSON.parse(raw); }
    catch { return res.status(422).json({ error: "Model returned invalid JSON for DCF config" }); }

    if (!parsed.dcf_config || !parsed.terraform_code) {
      return res.status(422).json({ error: "Incomplete DCF response from model" });
    }

    res.status(200).json(parsed);
  } catch (err: any) {
    Sentry.captureException(err);
    const msg = err?.message || String(err);
    const status = msg.includes("401") ? 401 : msg.includes("429") ? 429 : 500;
    res.status(status).json({ error: msg });
  }
}
