import { checkOrigin } from "./_origin.js";

// Fallback Aviatrix modules always included
const AVIATRIX_MODULES = [
  "terraform-aviatrix-modules/mc-transit/aviatrix",
  "terraform-aviatrix-modules/mc-spoke/aviatrix",
  "terraform-aviatrix-modules/mc-firenet/aviatrix",
];

// Variables to extract per module (curated list; for unknown modules extract all non-null defaults)
const CURATED = {
  "terraform-aviatrix-modules/mc-transit/aviatrix": [
    "gw_size","ha_gw","insane_mode","connected_transit","enable_segmentation",
    "bgp_ecmp","single_az_ha","bgp_polling_time","tunnel_detection_time",
    "enable_firenet","enable_transit_firenet","local_as_number",
  ],
  "terraform-aviatrix-modules/mc-spoke/aviatrix": [
    "gw_size","ha_gw","insane_mode","attached","single_az_ha",
    "enable_bgp","tunnel_detection_time","transit_gateway",
  ],
  "terraform-aviatrix-modules/mc-firenet/aviatrix": [
    "fw_amount","inspection_enabled","egress_enabled","attached",
    "firewall_image","firewall_image_version","instance_size","hashing_algorithm",
  ],
};

async function fetchModule(source) {
  const url = `https://registry.terraform.io/v1/modules/${source}`;
  const r = await fetch(url, {
    headers: { "User-Agent": "terraform-design-doc/1.0" },
    signal: AbortSignal.timeout(5000),
  });
  if (!r.ok) return null;
  const data = await r.json();
  if (data.errors) return null;

  const curated = CURATED[source];
  const allInputs = data.root?.inputs || [];

  const inputs = curated
    ? allInputs.filter(i => curated.includes(i.name))
    : allInputs.filter(i => i.default !== null && i.default !== "" && i.default !== undefined);

  return {
    source,
    version: data.version || "unknown",
    description: data.description || "",
    inputs: inputs.map(i => ({
      name: i.name,
      default: i.default ?? null,
      type: i.type || "string",
      description: i.description || "",
    })),
  };
}

export default async function handler(req, res) {
  if (req.method !== "POST" && req.method !== "GET") return res.status(405).end();
  if (!checkOrigin(req, res)) return;

  // Accept dynamic module list from client (POST) or fall back to Aviatrix defaults (GET)
  const detected = req.method === "POST" ? (req.body?.modules || []) : [];
  const toFetch = [...new Set([...AVIATRIX_MODULES, ...detected])];

  try {
    const results = await Promise.allSettled(toFetch.map(fetchModule));

    const modules = results
      .map((r, i) => r.status === "fulfilled" && r.value ? r.value : null)
      .filter(Boolean);

    res.setHeader("Cache-Control", "public, max-age=3600, s-maxage=3600");
    res.json({ modules, fetchedAt: new Date().toISOString() });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}
