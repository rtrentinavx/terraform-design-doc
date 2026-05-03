import { checkOrigin } from "./_origin.js";

const MODULES = [
  { key: "mc-transit",  name: "mc-transit",  namespace: "terraform-aviatrix-modules", provider: "aviatrix" },
  { key: "mc-spoke",    name: "mc-spoke",    namespace: "terraform-aviatrix-modules", provider: "aviatrix" },
  { key: "mc-firenet",  name: "mc-firenet",  namespace: "terraform-aviatrix-modules", provider: "aviatrix" },
];

// Variables we care about for each module (skip cosmetic/provider-specific noise)
const RELEVANT = {
  "mc-transit": ["gw_size","ha_gw","insane_mode","connected_transit","enable_segmentation",
    "bgp_ecmp","single_az_ha","bgp_polling_time","tunnel_detection_time","enable_firenet",
    "enable_transit_firenet","local_as_number"],
  "mc-spoke":   ["gw_size","ha_gw","insane_mode","attached","single_az_ha","enable_bgp",
    "tunnel_detection_time","transit_gateway"],
  "mc-firenet": ["fw_amount","inspection_enabled","egress_enabled","attached","firewall_image",
    "firewall_image_version","instance_size","hashing_algorithm"],
};

export default async function handler(req, res) {
  if (req.method !== "GET") return res.status(405).end();
  if (!checkOrigin(req, res)) return;

  try {
    const results = await Promise.all(
      MODULES.map(async (m) => {
        const url = `https://registry.terraform.io/v1/modules/${m.namespace}/${m.name}/${m.provider}`;
        const r = await fetch(url, { headers: { "User-Agent": "terraform-design-doc/1.0" } });
        if (!r.ok) return { key: m.key, version: "unknown", inputs: [] };
        const data = await r.json();
        const relevant = RELEVANT[m.key] || [];
        const inputs = (data.root?.inputs || [])
          .filter(i => relevant.includes(i.name))
          .map(i => ({ name: i.name, default: i.default ?? null, type: i.type || "string" }));
        return { key: m.key, version: data.version || "unknown", inputs };
      })
    );

    // Cache for 24 hours at CDN level
    res.setHeader("Cache-Control", "public, max-age=86400, s-maxage=86400");
    res.json({ modules: results, fetchedAt: new Date().toISOString() });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}
