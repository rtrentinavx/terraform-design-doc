import { useState, useRef, useCallback, useEffect } from "react";

// ── Constants ──────────────────────────────────────────────────────────────
const APP_VERSION       = "1.0.0";
const APP_MODEL_DEFAULT = "claude-sonnet-4-20250514";
const AVAILABLE_MODELS  = [
  { label:"Claude Sonnet 4.6 (default)", value:"claude-sonnet-4-20250514"  },
  { label:"Claude Opus 4.6",             value:"claude-opus-4-20250514"    },
  { label:"Claude Haiku 4.5",            value:"claude-haiku-4-5-20251001" },
];
const API_URL = "/api/analyze";

// ── Safe storage ───────────────────────────────────────────────────────────
const mem={};
const sg=k=>{try{return localStorage.getItem(k);}catch{return mem[k]||null;}};
const ss=(k,v)=>{try{localStorage.setItem(k,v);}catch{mem[k]=v;}};
const sd=k=>{try{localStorage.removeItem(k);}catch{delete mem[k];}};

// ── Theme ──────────────────────────────────────────────────────────────────
const DARK={or:"#FF6B35",pu:"#7B2FBE",nv:"#0A0E1A",nm:"#0F1628",nl:"#1A2240",nb:"#1E2D50",tp:"#F0F4FF",tm:"#7A8AAD",td:"#3A4A6A"};
const LIGHT={or:"#E05A2B",pu:"#6B21A8",nv:"#F8FAFC",nm:"#FFFFFF",nl:"#F1F5F9",nb:"#E2E8F0",tp:"#0F172A",tm:"#475569",td:"#94A3B8"};
let AV=DARK;

// ── System prompt ──────────────────────────────────────────────────────────
const SYS=`You are a senior cloud infrastructure architect writing a formal Infrastructure Design Document (IDD). Return ONLY valid JSON (no markdown, no backticks).

IMPORTANT — DESCRIPTIONS: Every "description" field must be a meaningful 2-4 sentence explanation. Do NOT leave descriptions empty or generic. Explain the WHY and HOW:
- executive_summary: Summarize the full architecture purpose, cloud provider, key design patterns, HA strategy, and security posture in 3-5 sentences.
- architecture_overview.description: Explain the topology pattern, how transit/spoke VPCs interconnect, regional strategy, and connectivity model.
- network_design.description: Explain the IP addressing strategy, CIDR allocation, subnet layout, and how traffic routes between VPCs.
- Each VPC purpose: Explain what workloads or services the VPC hosts and why it exists.
- security.description: Explain the overall security architecture including firewall placement, inspection model, encryption, and access control strategy.
- compute.description: Explain the compute instances deployed, their roles, sizing rationale, and HA configuration.
- Each component purpose: Explain what the component does in the architecture and why it is needed.
- Each data_flow description: Explain the traffic path, what triggers it, and any inspection/encryption along the way.
- routing: Explain the routing model (BGP, static, dynamic), route propagation, and any route filtering.
- network_domains: Explain Aviatrix Network Domains strategy and how domains are isolated. Only populate if enable_segmentation=true is set on transit gateways; leave empty string if not enabled.
- connectivity: Explain how on-prem, edge, and cloud networks interconnect.
- deployment_notes: Explain deployment order, dependencies, prerequisites, and any automation considerations.

{
  "title":"string","version":"1.0","date":"MUST be today's date in YYYY-MM-DD format","provider":"aws|azure|gcp|multi|unknown","firewall_vendor":"palo_alto|fortinet|checkpoint|cisco|none|unknown",
  "executive_summary":"string (3-5 sentences)",
  "architecture_overview":{"description":"string (2-4 sentences)","pattern":"hub-and-spoke|flat|mesh|hybrid|unknown","regions":["string"],"availability_zones":["string"],"diagram_description":"string"},
  "network_design":{"description":"string (2-4 sentences)","vpcs":[{"name":"string","cidr":"string","purpose":"string (1-2 sentences)","type":"transit|spoke|mgmt|shared|unknown","gw_size":"string (VM instance type)","connected_transit":"string (name of the transit VPC this spoke/mgmt VPC attaches to — MUST match a transit VPC name exactly; leave empty for transit VPCs)","firenet":"boolean — true ONLY if this specific transit has FireNet enabled (aviatrix_firenet, mc-firenet, or enable_firenet=true for THIS transit); false for all others"}],"subnets":[{"name":"string","cidr":"string","purpose":"string","az":"string","vpc":"string (name of the VPC this subnet belongs to — MUST match a VPC name exactly)"}],"routing":"string (2-3 sentences)","network_domains":"string (2-3 sentences, only if enable_segmentation=true on transit gateways; empty string if not enabled)","connectivity":"string (2-3 sentences)"},
  "compute":{"description":"string (2-3 sentences)","instances":[{"name":"string","type":"string","purpose":"string","ha":true}]},
  "security":{"description":"string (2-4 sentences)","firewall":"string (1-2 sentences)","encryption":"string (1-2 sentences)","access_control":"string (1-2 sentences)","inspection":"string (1-2 sentences)"},
  "firewall_detail":{"present":true,"vendor":"string REQUIRED","product":"string REQUIRED","instance_size":"string REQUIRED (VM instance type e.g. c5.xlarge)","vcpus":"string REQUIRED","memory_gb":"string REQUIRED","license_model":"BYOL|PAYG|included|unknown","license_type":"string REQUIRED","ha_mode":"active-active|active-passive|standalone|unknown","ha_instances":2,"deployment_mode":"string REQUIRED","interfaces":["management","egress","lan"],"version":"string","notes":"string REQUIRED (2-3 sentences explaining firewall deployment)"},
  "firewall_context":"string (1-2 sentences)",
  "components":[{"name":"string","type":"string","category":"compute|network|storage|database|security|monitoring|other","purpose":"string (1-2 sentences)","configuration":"string","dependencies":["string"]}],
  "data_flows":[{"name":"string","description":"string (1-2 sentences)","path":["string"]}],
  "modules_used":[{"name":"string","source":"string","version":"string","purpose":"string"}],
  "variables_and_parameters":[{"name":"string","value_or_type":"string","purpose":"string","required":true}],
  "outputs":[{"name":"string","description":"string","consumed_by":"string"}],
  "deployment_notes":"string (2-3 sentences)","provider_context":"string (1-2 sentences)",
  "edge_devices":[{"name":"string","type":"selfmanaged|equinix|zscaler|platform|megaport|csp|spoke","location":"string","size":"string","ha":false,"wan":"string","lan":"string","connected_transit":"string (comma-separated if attached to multiple transits)","bgp_asn":"string"}],
  "external_connections":[{"name":"string","type":"bgp|static|ipsec","local_gw":"string","remote_ip":"string","bgp_asn":"string","tunnel_protocol":"string"}],
  "dcf":{"enabled":false,"default_action":"deny|allow|unknown","smart_groups":[{"name":"string","description":"string","filter_type":"string","members":["string"]}],"web_groups":[{"name":"string","domains":["string"]}],"rulesets":[{"name":"string","type":"user|egress|system|unknown","rules":[{"name":"string","priority":0,"src":"string","dst":"string","protocol":"string","port":"string","action":"allow|deny|force-drop","logging":false,"tls_decryption":false,"ips_profile":"string"}]}],"ips_profiles":[{"name":"string","feeds":["string"],"actions":{"informational":"string","minor":"string","major":"string","critical":"string"},"applied_to":["string"]}],"egress_enabled":false,"tls_decryption_enabled":false,"kubernetes_enabled":false,"transit_egress":false,"summary":"string (2-3 sentences)"}
}

AVIATRIX TERRAFORM DEFAULTS — Use these when values are NOT explicitly set in the uploaded Terraform files:

mc-transit module defaults:
  gw_size: AWS=t3.medium, Azure=Standard_B1ms, GCP=n1-standard-1, OCI=VM.Standard2.2
  gw_size (insane_mode=true or firenet): AWS=c5n.xlarge, Azure=Standard_D3_v2, GCP=n1-highcpu-4, OCI=VM.Standard2.4
  ha_gw=true, insane_mode=false, connected_transit=true, bgp_ecmp=false, enable_segmentation=false, single_az_ha=true, bgp_polling_time=50s, tunnel_detection_time=60s

mc-spoke module defaults:
  gw_size: AWS=t3.medium, Azure=Standard_B1ms, GCP=n1-standard-1, OCI=VM.Standard2.2
  ha_gw=true, insane_mode=false, attached=true, single_az_ha=true, enable_bgp=false, tunnel_detection_time=60s

mc-firenet module defaults:
  fw instance_size: AWS=c5.xlarge, Azure=Standard_D3_v2, GCP=n1-standard-4, OCI=VM.Standard2.4
  fw_amount=2, inspection_enabled=true, egress_enabled=false, attached=true

aviatrix_transit_gateway resource defaults:
  gw_size=REQUIRED, ha_gw_size inherits gw_size if omitted, single_az_ha=false, connected_transit=false, enable_segmentation=false, insane_mode=false, bgp_ecmp=false, bgp_polling_time=50, tunnel_detection_time=60

aviatrix_spoke_gateway resource defaults:
  gw_size=REQUIRED, ha_gw_size inherits gw_size if omitted, single_az_ha=false, manage_transit_gateway_attachment=true, tunnel_detection_time=60

aviatrix_firenet resource defaults:
  inspection_enabled=true, egress_enabled=false, hashing_algorithm=5-Tuple, manage_firewall_instance_association=true

GATEWAY SIZES: For each VPC, extract the Aviatrix gateway VM instance size (gw_size). Look at gw_size in aviatrix_transit_gateway, aviatrix_spoke_gateway resources, OR instance_size in mc-transit/mc-spoke modules. If not explicitly set, apply the defaults above based on cloud provider and whether insane_mode/firenet is enabled. Always include the VM instance type string (e.g. "t3.medium", "c5n.xlarge", "Standard_D3_v2"). If HA is enabled (ha_gw=true or ha_subnet set), append " (HA)" to gw_size.

SPOKE/MGMT VPC TRANSIT ATTACHMENT — CRITICAL: For every non-transit VPC, you MUST populate connected_transit with the exact name of the transit VPC it attaches to. Look at:
- mc-spoke module: transit_gateway parameter specifies the transit gateway name
- aviatrix_spoke_transit_attachment resource: spoke_gw_name and transit_gw_name
- aviatrix_spoke_gateway: transit_gw parameter
- Any resource linking a spoke/mgmt gateway to a transit gateway
The connected_transit value MUST exactly match the "name" of one of the transit VPCs in the vpcs array. If a spoke connects to multiple transits, comma-separate them. NEVER leave connected_transit empty for spoke/mgmt VPCs.

FIREWALL — CRITICAL: This is the MOST IMPORTANT section. Search ALL uploaded files thoroughly for ANY mention of firewalls.
Set firewall_detail.present=true if ANY of these are found ANYWHERE in the code: aviatrix_firewall_instance, aviatrix_firenet, mc-firenet module, enable_firenet=true, firewall_image, firewall_size, fw_amount, or any string containing "Palo Alto", "FortiGate", "CloudGuard", "VM-Series", "Bundle 1", "Bundle 2", "BYOL", "PAYG", "NGFW", "firenet".
When present=true, you MUST populate EVERY field — do NOT leave any as empty string or null:
- vendor: Full vendor name (e.g. "Palo Alto Networks", "Fortinet", "Check Point"). Parse from firewall_image variable/string.
- product: Product name (e.g. "VM-Series", "FortiGate", "CloudGuard"). Parse from firewall_image.
- instance_size: VM instance type (e.g. "c5.xlarge", "Standard_D3_v2"). Look at firewall_size/instance_size in mc-firenet module or firewall_size in aviatrix_firewall_instance. Default: AWS=c5.xlarge, Azure=Standard_D3_v2, GCP=n1-standard-4.
- vcpus: Number of vCPUs. Map from instance_size: c5.xlarge=4, c5.2xlarge=8, Standard_D3_v2=4, n1-standard-4=4.
- memory_gb: Memory in GB. Map: c5.xlarge=8, c5.2xlarge=16, Standard_D3_v2=14, n1-standard-4=15.
- license_model: BYOL or PAYG. Parse from firewall_image string — "BYOL" in name means BYOL, "Bundle" means PAYG.
- license_type: Specific license string (e.g. "Bundle 1", "Bundle 2", "BYOL")
- ha_mode: mc-firenet with fw_amount>=2 → "active-active". Single firewall → "standalone".
- ha_instances: fw_amount value (default=2 for mc-firenet)
- deployment_mode: "Transit FireNet" if transit+firenet, "FireNet" otherwise
- interfaces: ["management","egress","lan"] for Transit FireNet
- version: from firewall_image if version present, else "latest"
- notes: 2-3 sentence explanation of firewall deployment, inspection mode, and HA strategy. NEVER leave empty.

Image string mapping: "Palo Alto Networks VM-Series Next-Generation Firewall Bundle 1"→vendor=Palo Alto Networks,product=VM-Series,license_model=PAYG,license_type=Bundle 1; "...Bundle 2"→Bundle 2; "...(BYOL)"→BYOL; "Fortinet FortiGate (BYOL)..."→vendor=Fortinet,BYOL; "Fortinet FortiGate Next-Generation..."→PAYG; "Check Point CloudGuard...BYOL"→vendor=Check Point,BYOL.

Firewall instance_size defaults (mc-firenet) — use when instance_size not set:
  AWS: c5.xlarge → 4 vCPU, 8 GB RAM
  Azure: Standard_D3_v2 → 4 vCPU, 14 GB RAM
  GCP: n1-standard-4 → 4 vCPU, 15 GB RAM
  OCI: VM.Standard2.4 → 4 vCPU, 60 GB RAM
Common instance type specs (populate vcpus and memory_gb from these):
  c5.xlarge=4vCPU/8GB, c5.2xlarge=8vCPU/16GB, c5.4xlarge=16vCPU/32GB
  m5.xlarge=4vCPU/16GB, m5.2xlarge=8vCPU/32GB
  Standard_D3_v2=4vCPU/14GB, Standard_D4_v2=8vCPU/28GB
  n1-standard-4=4vCPU/15GB, n1-standard-8=8vCPU/30GB

EDGE: aviatrix_edge_gateway_selfmanaged→selfmanaged, aviatrix_edge_equinix→equinix, aviatrix_edge_zscaler→zscaler, aviatrix_edge_platform→platform, aviatrix_edge_megaport→megaport, aviatrix_edge_spoke→spoke. Extract gw_name, site_id→location, gw_size→size, wan_interface_names→wan, lan_interface_names→lan, bgp_local_as_num→bgp_asn. aviatrix_edge_spoke_transit_attachment→connected_transit. HA resource→ha=true. Edge devices connect to TRANSIT gateways only, never spoke VPCs.

EXTERNAL: aviatrix_transit_external_device_conn→external_connections[].

DCF: aviatrix_distributed_firewalling_policy_list policies{}→rules (PERMIT→allow, DENY→deny). aviatrix_distributed_firewalling_default_action_rule→default_action. Predefined: "any"=def000ad-0000-0000-0000-000000000000, "internet"=def000ad-0000-0000-0000-000000000001. Default action: 1)default_action_rule 2)policy named default/Greenfield 3)if DCF enabled→allow 4)unknown.`;

// ── Icons ──────────────────────────────────────────────────────────────────
const IC={vpc:"M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 14H9V8h2v8zm4 0h-2V8h2v8z",subnet:"M4 6h16v2H4zm0 5h16v2H4zm0 5h16v2H4z",igw:"M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5",tgw:"M12 2a10 10 0 1 0 0 20A10 10 0 0 0 12 2zm0 3l7 4-7 4-7-4 7-4zm0 9l7-4v5l-7 4-7-4v-5l7 4z",fw:"M12 2l9 4.5v5c0 5.25-3.84 10.15-9 11.5C6.84 21.65 3 16.75 3 11.5v-5L12 2z",dcf:"M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4z",gw:"M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5",net:"M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 2c1.1 0 2 .9 2 2s-.9 2-2 2-2-.9-2-2 .9-2 2-2z",home:"M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z M9 22V12h6v10",edge:"M13 2L3 14h9l-1 8 10-12h-9l1-8z"};
const Ico=({d,x,y,sz=13,c="#fff"})=><svg x={x-sz/2} y={y-sz/2} width={sz} height={sz} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d={d} fill="none" stroke={c} strokeWidth="2"/></svg>;

// ── Cloud Provider Logos (filled SVG paths) ────────────────────────────────
const ProvLogo=({prov,x,y,sz=40})=>{
  if(prov==="aws")return(<svg x={x} y={y} width={sz} height={sz} viewBox="0 0 64 64">
    <path d="M18.1 28.2c0 .9.1 1.6.3 2.2.2.5.5 1.1.8 1.8.1.2.2.4.2.6 0 .3-.2.5-.5.7l-1.7 1.1c-.2.1-.4.2-.6.2-.3 0-.5-.1-.7-.4-.3-.4-.6-.7-.9-1.1-.2-.4-.5-.8-.8-1.3-2 2.4-4.5 3.5-7.6 3.5-2.2 0-3.9-.6-5.2-1.8-1.3-1.2-2-2.8-2-4.8 0-2.1.7-3.8 2.2-5.1 1.5-1.3 3.5-1.9 5.9-1.9.8 0 1.7.1 2.6.2.9.1 1.9.3 2.9.5v-1.8c0-1.9-.4-3.2-1.2-4-.8-.8-2.1-1.2-4.1-1.2-.9 0-1.8.1-2.7.3-.9.2-1.9.5-2.7.9-.4.2-.7.3-.9.3-.4 0-.6-.3-.6-.8v-1.3c0-.4.1-.7.2-.9.1-.2.4-.4.8-.6 .9-.5 2-.8 3.2-1.1 1.3-.3 2.6-.5 4.1-.5 3.1 0 5.3.7 6.8 2.1 1.4 1.4 2.1 3.6 2.1 6.4v8.4zm-10.5 3.9c.8 0 1.6-.1 2.5-.4.9-.3 1.7-.8 2.3-1.5.4-.4.6-.9.8-1.5.1-.6.2-1.3.2-2.1v-1c-.7-.2-1.5-.3-2.3-.4-.8-.1-1.6-.1-2.3-.1-1.6 0-2.8.3-3.6 1-.8.7-1.2 1.6-1.2 2.8 0 1.1.3 2 .9 2.5.6.5 1.5.8 2.7.8zm20.8 2.8c-.3 0-.6-.1-.7-.2-.2-.1-.3-.4-.5-.8l-5.2-17.1c-.1-.4-.2-.7-.2-.9 0-.4.2-.6.6-.6h2.6c.4 0 .6.1.7.2.2.1.3.4.4.8l3.7 14.6 3.5-14.6c.1-.4.2-.7.4-.8.1-.1.4-.2.8-.2h2.1c.4 0 .6.1.8.2.1.2.3.4.4.8l3.5 14.8 3.8-14.8c.1-.4.3-.7.4-.8.2-.1.4-.2.7-.2h2.5c.4 0 .6.2.6.6 0 .1 0 .3-.1.4 0 .2-.1.3-.2.6l-5.3 17.1c-.1.4-.3.7-.5.8-.2.1-.4.2-.7.2h-2.3c-.4 0-.6-.1-.8-.2-.1-.2-.3-.4-.4-.8L34 19.9l-3.4 14c-.1.4-.2.7-.4.8-.1.2-.4.2-.8.2h-2.3zm33.2.7c-1.3 0-2.5-.1-3.7-.4-1.2-.3-2.1-.6-2.8-1-.4-.3-.7-.5-.8-.8-.1-.3-.2-.5-.2-.8v-1.3c0-.5.2-.8.6-.8.2 0 .3 0 .5.1.2.1.4.2.7.3.9.4 1.9.7 3 1 1.1.2 2.1.3 3.2.3 1.7 0 3-.3 3.9-1 .9-.6 1.4-1.6 1.4-2.7 0-.8-.3-1.5-.8-2-.5-.6-1.5-1.1-3-1.6l-4.3-1.3c-2.1-.7-3.7-1.6-4.7-2.9-1-1.2-1.4-2.6-1.4-4 0-1.2.3-2.2.8-3.1.5-.9 1.2-1.6 2.1-2.2.9-.6 1.8-1 3-1.3 1.1-.3 2.3-.4 3.6-.4.6 0 1.3 0 1.9.1.7.1 1.3.2 1.9.4.6.1 1.1.3 1.6.5.5.2.9.4 1.2.6.4.2.6.5.8.7.2.2.2.5.2.9v1.2c0 .5-.2.8-.6.8-.2 0-.5-.1-.9-.3-1.4-.6-2.9-1-4.7-1-1.5 0-2.7.3-3.5.8-.8.5-1.2 1.4-1.2 2.5 0 .8.3 1.5.9 2 .6.5 1.7 1.1 3.2 1.6l4.2 1.3c2.1.7 3.6 1.6 4.5 2.8.9 1.2 1.4 2.5 1.4 4 0 1.2-.2 2.3-.7 3.3-.5 1-1.2 1.8-2.1 2.5-.9.7-2 1.2-3.3 1.5-1.3.4-2.7.5-4.2.5z" fill="#FF9900"/>
    <path d="M57.4 45.2c-6.7 5-16.4 7.6-24.8 7.6-11.7 0-22.3-4.3-30.3-11.6-.6-.6-.1-1.3.7-.9 8.6 5 19.3 8.1 30.3 8.1 7.4 0 15.6-1.5 23.1-4.7 1.1-.5 2.1.7 1 1.5zm2.8-3.2c-.9-1.1-5.6-.5-7.8-.3-.7.1-.8-.5-.2-.9 3.8-2.7 10-1.9 10.7-1 .7.9-.2 7.1-3.7 10.1-.6.5-1.1.2-.8-.4.8-2 2.6-6.3 1.8-7.5z" fill="#FF9900"/>
  </svg>);
  if(prov==="azure")return(<svg x={x} y={y} width={sz} height={sz} viewBox="0 0 64 64">
    <path d="M22.4 4h13.5L21.8 57.5c-.3.8-1 1.4-1.9 1.4H8.2c-1.2 0-2.1-1-2.1-2.2 0-.3.1-.5.1-.8L19.6 5.4c.3-.8 1-1.4 1.9-1.4h.9z" fill="#0078D4"/>
    <path d="M49.5 39.7H26.9c-.5 0-1 .5-.7 1l14.6 16.6c.4.4.9.7 1.4.7h13.9L49.5 39.7z" fill="#0078D4" opacity=".7"/>
    <path d="M22.4 4C21.4 4 20.5 4.7 20.2 5.5L6.3 55.8c-.5 1.3.5 2.6 1.8 2.6h13c.8 0 1.5-.5 1.8-1.2l3.3-9.5 9.4 10.7c.4.4.9.7 1.5.7h13.8l-6.1-18.3-16.8-2L40 4H22.4z" fill="#0078D4"/>
    <path d="M45.4 5.5c-.3-.8-1.1-1.5-2-1.5H22.8c.9 0 1.7.6 2 1.5l13.4 50.4c.5 1.3-.5 2.6-1.8 2.6h20.5c1.3 0 2.3-1.3 1.8-2.6L45.4 5.5z" fill="#0078D4" opacity=".8"/>
  </svg>);
  if(prov==="gcp")return(<svg x={x} y={y} width={sz} height={sz} viewBox="0 0 64 64">
    <path d="M40.8 19.2h2.2l6.3-6.3.3-2.7A27.5 27.5 0 0 0 4.8 26.4c.5-.1 2.5-.3 2.5-.3l12.6-2.1s.6-1.1 1-1a15.3 15.3 0 0 1 19.9-3.8z" fill="#EA4335"/>
    <path d="M55.2 26.4a27.7 27.7 0 0 0-8.4-13.5L40.5 19a15.2 15.2 0 0 1 5.6 12.4v1.6c4.3 0 7.8 3.5 7.8 7.8s-3.5 7.8-7.8 7.8H32l-1.6 1.6v9.4l1.6 1.6h14.1a20.4 20.4 0 0 0 9.1-34.8z" fill="#4285F4"/>
    <path d="M17.9 61.2h14.1V48.6H17.9a7.7 7.7 0 0 1-3.2-.7l-2.2.7-6.3 6.3-.6 2.2a20.2 20.2 0 0 0 12.3 3.9z" fill="#34A853"/>
    <path d="M17.9 20.4a20.4 20.4 0 0 0-12.3 36.5l9.1-9.1A7.8 7.8 0 1 1 25.1 33l9.1-9.1a20.4 20.4 0 0 0-16.3-3.5z" fill="#FBBC05"/>
  </svg>);
  // multi / unknown — generic cloud
  return(<svg x={x} y={y} width={sz} height={sz} viewBox="0 0 24 24" fill="none">
    <path d="M6.5 20a4.5 4.5 0 0 1-.42-8.98 7 7 0 0 1 13.84 0A4.5 4.5 0 0 1 17.5 20H6.5z" fill={AV.or} opacity="0.3" stroke={AV.or} strokeWidth="1"/>
  </svg>);
};

// ── Aviatrix Logo (simplified plane) ────────────────────────────────────────
const AvxLogo=({x,y,sz=20,c="#FF6B35"})=><svg x={x} y={y} width={sz} height={sz} viewBox="0 0 24 24">
  <path d="M21 16v-2l-8-5V3.5c0-.83-.67-1.5-1.5-1.5S10 2.67 10 3.5V9l-8 5v2l8-2.5V19l-2 1.5V22l3.5-1 3.5 1v-1.5L13 19v-5.5l8 2.5z" fill={c}/>
</svg>;

// ── Aviatrix Transit Gateway Icon (hub with radiating connections) ─────────
const AvxTransitIco=({x,y,sz=18,c="#FF6B35"})=><svg x={x} y={y} width={sz} height={sz} viewBox="0 0 24 24">
  <circle cx="12" cy="12" r="4.5" fill={c} opacity="0.2" stroke={c} strokeWidth="1.2"/>
  <circle cx="12" cy="12" r="2" fill={c}/>
  {/* Radiating spokes */}
  <line x1="12" y1="2" x2="12" y2="7" stroke={c} strokeWidth="1.2" strokeLinecap="round"/>
  <line x1="12" y1="17" x2="12" y2="22" stroke={c} strokeWidth="1.2" strokeLinecap="round"/>
  <line x1="2" y1="12" x2="7" y2="12" stroke={c} strokeWidth="1.2" strokeLinecap="round"/>
  <line x1="17" y1="12" x2="22" y2="12" stroke={c} strokeWidth="1.2" strokeLinecap="round"/>
  {/* Corner nodes */}
  <circle cx="12" cy="2" r="1.3" fill={c}/><circle cx="12" cy="22" r="1.3" fill={c}/>
  <circle cx="2" cy="12" r="1.3" fill={c}/><circle cx="22" cy="12" r="1.3" fill={c}/>
</svg>;

// ── Aviatrix Spoke Gateway Icon (endpoint with single uplink) ─────────────
const AvxSpokeIco=({x,y,sz=18,c="#FF6B35"})=><svg x={x} y={y} width={sz} height={sz} viewBox="0 0 24 24">
  <rect x="5" y="10" width="14" height="10" rx="2.5" fill={c} opacity="0.15" stroke={c} strokeWidth="1.2"/>
  <circle cx="12" cy="15" r="2.5" fill={c} opacity="0.3" stroke={c} strokeWidth="1"/>
  <circle cx="12" cy="15" r="1" fill={c}/>
  {/* Uplink arrow to transit */}
  <line x1="12" y1="10" x2="12" y2="4" stroke={c} strokeWidth="1.4" strokeLinecap="round"/>
  <path d="M9 6.5L12 3l3 3.5" fill="none" stroke={c} strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/>
</svg>;

// ── Cloud VPC/VNet Icon (official architecture icons) ─────────────────────
let vpcIcoId=0;
const VpcIcon=({prov,x,y,sz=16})=>{
  const uid=`vpci-${vpcIcoId++}`;
  if(prov==="aws")return(<svg x={x} y={y} width={sz} height={sz} viewBox="0 0 64 64">
    <defs><linearGradient id={uid} x1="0%" y1="100%" x2="100%" y2="0%"><stop offset="0%" stopColor="#4D27A8"/><stop offset="100%" stopColor="#A166FF"/></linearGradient></defs>
    <rect width="64" height="64" rx="8" fill={`url(#${uid})`}/>
    <path d="M48,33.98L44.5,32.51V46.88C47.91,46.15 48,42.18 48,42L48,33.98ZM42.5,46.92V32.51L39,33.98V42C39.01,42.47 39.18,46.34 42.5,46.92ZM43.11,30.08C43.36,29.98 43.64,29.98 43.89,30.08L49.39,32.39C49.76,32.55 50,32.91 50,33.31V42C49.98,44.43 48.56,49 43.37,49C38.39,49 37.03,44.43 37,42.02V33.31C37,32.91 37.24,32.55 37.61,32.39L43.11,30.08ZM52,30.79L43.49,27.09L35,30.67V41.03C35,41.09 34.96,46.01 37.81,48.89C39.19,50.29 41.06,51 43.37,51C51.81,51 52,41.43 52,41.02V30.79ZM54,30.14V41.03C53.97,45.17 51.72,53 43.37,53C40.5,53 38.15,52.09 36.37,50.29C32.94,46.8 33,41.24 33,41.01V30C33,29.6 33.24,29.24 33.61,29.08L43.11,25.08C43.36,24.98 43.65,24.98 43.9,25.09L53.4,29.22C53.76,29.38 54,29.74 54,30.14ZM19,38H30V40H19C14.22,40 10.27,36.48 10.02,31.99C10,31.81 10,31.6 10,31.39C10,26.09 13.65,24.04 15.92,23.28C15.9,23.06 15.89,22.84 15.89,22.63C15.89,18.04 18.66,13.7 22.62,12.08C27.58,10.05 33.24,10.94 36.7,14.29C37.72,15.28 38.6,16.6 39.34,18.21C40.3,17.42 41.39,17 42.52,17C45.23,17 48.28,19.3 48.9,23.06C51.07,23.34 52.94,24.64 53.9,26.58L52.1,27.47C51.34,25.93 49.81,25 48,25C47.47,25 47.03,24.59 47,24.06C46.81,20.76 44.28,19 42.52,19C41.55,19 40.58,19.57 39.8,20.61C39.58,20.9 39.22,21.05 38.85,20.99C38.49,20.94 38.19,20.69 38.06,20.35C37.33,18.35 36.4,16.79 35.3,15.72C32.41,12.92 27.62,12.2 23.38,13.93C19.78,15.41 17.89,19.42 17.89,22.63C17.89,23.03 17.95,23.5 17.99,23.89C18.05,24.39 17.73,24.85 17.24,24.98C15.28,25.46 12,26.94 12,31.39C12,31.54 12,31.69 12.01,31.84C12.21,35.31 15.28,38 19,38Z" fill="#FFFFFF"/>
  </svg>);
  if(prov==="azure")return(<svg x={x} y={y} width={sz} height={sz} viewBox="0 0 24 24">
    {/* Official Azure VNet — redrawn with simple lines for clarity at small sizes */}
    <rect width="24" height="24" rx="3" fill="#0078D4"/>
    {/* X-arms matching official colors #50e6ff and #1490df */}
    <line x1="5" y1="5" x2="19" y2="19" stroke="#1490df" strokeWidth="2" strokeLinecap="round"/>
    <line x1="19" y1="5" x2="5" y2="19" stroke="#50e6ff" strokeWidth="2" strokeLinecap="round"/>
    {/* Three green nodes matching official #86d633 */}
    <circle cx="7" cy="12" r="2.2" fill="#86d633"/>
    <circle cx="12" cy="12" r="2.2" fill="#86d633"/>
    <circle cx="17" cy="12" r="2.2" fill="#86d633"/>
  </svg>);
  if(prov==="gcp")return(<svg x={x} y={y} width={sz} height={sz} viewBox="0 0 24 24">
    {/* Official GCP VPC Network icon */}
    <rect width="24" height="24" rx="3" fill="#4285F4"/>
    <rect x="16" y="2" width="6" height="6" fill="#aecbfa"/><rect x="19" y="2" width="3" height="6" fill="#669df6"/>
    <rect x="16" y="16" width="6" height="6" fill="#aecbfa"/><rect x="19" y="16" width="3" height="6" fill="#669df6"/>
    <rect x="2" y="2" width="6" height="6" fill="#aecbfa"/><rect x="5" y="2" width="3" height="6" fill="#669df6"/>
    <rect x="2" y="16" width="6" height="6" fill="#aecbfa"/><rect x="5" y="16" width="3" height="6" fill="#669df6"/>
    <rect x="8" y="4" width="8" height="2" fill="#fff"/><rect x="8" y="18" width="8" height="2" fill="#fff"/>
    <rect x="18" y="8" width="2" height="8" fill="#fff"/><rect x="4" y="8" width="2" height="8" fill="#fff"/>
  </svg>);
  // generic — cloud
  return(<svg x={x} y={y} width={sz} height={sz} viewBox="0 0 24 24" fill="none">
    <rect width="24" height="24" rx="3" fill="#6366F1"/>
    <path d="M6.5 18a3.5 3.5 0 0 1-.33-6.98 5.5 5.5 0 0 1 10.66 0A3.5 3.5 0 0 1 14.5 18H6.5z" fill="#fff"/>
  </svg>);
};

// ── Firewall Vendor Logo ────────────────────────────────────────────────────
const FwLogo=({vendor,x,y,sz=18})=>{
  const v=(vendor||"").toLowerCase();
  if(v.includes("palo"))return(<svg x={x} y={y} width={sz} height={sz} viewBox="0 0 24 24">
    <circle cx="12" cy="12" r="10" fill="#FA582D" opacity="0.15"/><circle cx="12" cy="12" r="10" fill="none" stroke="#FA582D" strokeWidth="1.5"/>
    <path d="M7 12h4V7h2v5h4v2h-4v5h-2v-5H7v-2z" fill="#FA582D"/>
  </svg>);
  if(v.includes("forti"))return(<svg x={x} y={y} width={sz} height={sz} viewBox="0 0 24 24">
    <rect x="2" y="2" width="20" height="20" rx="3" fill="#EE3124" opacity="0.15"/><rect x="2" y="2" width="20" height="20" rx="3" fill="none" stroke="#EE3124" strokeWidth="1.5"/>
    <text x="12" y="16" textAnchor="middle" fill="#EE3124" fontSize="12" fontWeight="900" fontFamily="Arial">F</text>
  </svg>);
  if(v.includes("check"))return(<svg x={x} y={y} width={sz} height={sz} viewBox="0 0 24 24">
    <rect x="2" y="2" width="20" height="20" rx="3" fill="#E1215B" opacity="0.15"/><rect x="2" y="2" width="20" height="20" rx="3" fill="none" stroke="#E1215B" strokeWidth="1.5"/>
    <path d="M6 12l4 4 8-8" fill="none" stroke="#E1215B" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>);
  // generic firewall shield
  return(<svg x={x} y={y} width={sz} height={sz} viewBox="0 0 24 24">
    <path d="M12 2l9 4.5v5c0 5.25-3.84 10.15-9 11.5C6.84 21.65 3 16.75 3 11.5v-5L12 2z" fill="#EC4899" opacity="0.15" stroke="#EC4899" strokeWidth="1.5"/>
  </svg>);
};

const CAT_TW={compute:{bg:"bg-orange-900/20",bd:"border-orange-500/30",tx:"text-orange-400"},network:{bg:"bg-blue-900/20",bd:"border-blue-500/30",tx:"text-blue-400"},storage:{bg:"bg-purple-900/20",bd:"border-purple-500/30",tx:"text-purple-400"},database:{bg:"bg-cyan-900/20",bd:"border-cyan-500/30",tx:"text-cyan-400"},security:{bg:"bg-pink-900/20",bd:"border-pink-500/30",tx:"text-pink-400"},monitoring:{bg:"bg-yellow-900/20",bd:"border-yellow-500/30",tx:"text-yellow-400"},other:{bg:"bg-slate-800/40",bd:"border-slate-600/30",tx:"text-slate-400"}};

const tr=(s,n)=>s&&s.length>n?s.slice(0,n-1)+"…":(s||"");
const Sec=({title,children})=><div className="mb-8"><div className="flex items-center gap-3 mb-4"><h2 className="text-xl font-black" style={{color:AV.tp}}>{title}</h2><div className="flex-1 h-px" style={{background:`linear-gradient(90deg,${AV.or}40,transparent)`}}/></div>{children}</div>;
const Pr=({t})=>t?<p className="text-sm leading-7" style={{color:AV.tm}}>{t}</p>:null;
const KV=({k,v})=>v?<div className="flex gap-2 text-sm"><span className="font-semibold min-w-32 shrink-0" style={{color:AV.tp}}>{k}</span><span style={{color:AV.tm}}>{v}</span></div>:null;

// ── Network Diagram (Lucidchart-style) ────────────────────────────────────
function Diagram({doc,dark}){
  // Clean flat palette
  const D=dark
    ?{bg:"#0B1120",card:"#111827",cardBd:"#1E293B",text:"#F1F5F9",sub:"#94A3B8",dim:"#64748B",line:"#334155",labelBg:"#1E293B",labelBd:"#334155",shadow:"rgba(0,0,0,0.4)"}
    :{bg:"#FFFFFF",card:"#FFFFFF",cardBd:"#E2E8F0",text:"#0F172A",sub:"#475569",dim:"#94A3B8",line:"#CBD5E0",labelBg:"#FFFFFF",labelBd:"#E2E8F0",shadow:"rgba(0,0,0,0.08)"};

  const nd=doc.network_design||{},ao=doc.architecture_overview||{},dcf=doc.dcf||{},fw=doc.firewall_detail||{};
  const vpcs=nd.vpcs||[],subs=nd.subnets||[],edges=doc.edge_devices||[];
  const extConns=doc.external_connections||[];
  const prov=doc.provider||"aws";
  const ctxStr=JSON.stringify(nd.connectivity||"")+JSON.stringify(ao.description||"")+JSON.stringify(nd.routing||"");
  const hasOnPrem=extConns.length>0||edges.length>0||/vpn|direct.connect|expressroute|dx|on.prem|datacenter|data.center|ipsec|bgp.*remote|site.to.site/i.test(ctxStr);
  const hasInet=(dcf.egress_enabled)||(dcf.rulesets||[]).some(rs=>(rs.rules||[]).some(r=>/internet/i.test(r.dst||"")||/internet/i.test(r.src||"")))||subs.some(s=>/pub/i.test(s.name||""))||/internet|igw|nat.gateway|egress|public.subnet|0\.0\.0\.0/i.test(ctxStr+JSON.stringify(subs)+JSON.stringify(doc.components||[]));

  const PC={aws:"#FF9900",azure:"#0078D4",gcp:"#34A853",multi:"#6366F1",unknown:"#6366F1"}[prov]||"#6366F1";
  const provName={aws:"AWS",azure:"Azure",gcp:"GCP",multi:"Multi-Cloud",unknown:"Cloud"}[prov]||"Cloud";

  // Detect cloud provider per VPC (for multi-cloud diagrams)
  // Check name first to avoid false positives from purpose mentioning other clouds
  const vpcProv=v=>{
    const nm=(v.name||"").toLowerCase();
    if(/azure|az-|vnet/.test(nm))return"azure";
    if(/gcp|google/.test(nm))return"gcp";
    if(/aws|amazon|ec2/.test(nm))return"aws";
    // Fallback: check purpose (but name takes priority above)
    const p=(v.purpose||"").toLowerCase();
    if(/azure|vnet/.test(p))return"azure";
    if(/gcp|google/.test(p))return"gcp";
    if(/aws|amazon|ec2/.test(p))return"aws";
    return prov==="multi"?"unknown":prov;
  };

  const hub=vpcs.filter(v=>v.type==="transit");
  const spk=vpcs.filter(v=>v.type!=="transit");
  const hV=hub.length>0?hub:vpcs.slice(0,Math.ceil(vpcs.length/2));
  const sV=hub.length>0?spk:vpcs.slice(Math.ceil(vpcs.length/2));

  const snFor=v=>{
    // First: match by explicit vpc field
    const byVpc=subs.filter(s=>s.vpc&&s.vpc.toLowerCase()===v.name.toLowerCase());
    if(byVpc.length>0)return byVpc.slice(0,5);
    // Fallback: fuzzy match — try full name, then parts, then short prefix
    const vn=(v.name||"").toLowerCase();
    const vnClean=vn.replace(/[-_\s]/g,"");
    const parts=vn.split(/[-_\s]/).filter(p=>p.length>2);
    return subs.filter(s=>{
      const sn=(s.name||"").toLowerCase();
      const snClean=sn.replace(/[-_\s]/g,"");
      // Exact substring match (either direction)
      if(snClean.includes(vnClean)||vnClean.includes(snClean))return true;
      // Any significant part of VPC name appears in subnet name
      if(parts.some(p=>sn.includes(p)))return true;
      // Short prefix match
      const k=vnClean.slice(0,8);
      if(k&&(snClean.startsWith(k)||snClean.includes(k)))return true;
      return false;
    }).slice(0,5);
  };
  const svcFor=v=>{
    const n=[];
    if(v.type==="transit"){
      n.push({type:"avx-transit",label:"Avx Transit GW",color:"#FF6B35"});
      if(fw.present&&v.firenet===true){const vn=fw.vendor||"";const fl=/palo/i.test(vn)?"Palo Alto":/forti/i.test(vn)?"Fortinet":/check/i.test(vn)?"CheckPoint":"NGFW";n.push({type:"fw",label:fl,color:"#EC4899"});}
      if(dcf.enabled)n.push({type:"dcf",label:"DCF",color:"#A855F7"});
    }else{
      n.push({type:"avx-spoke",label:"Avx Spoke GW",color:"#FF6B35"});
    }
    return n;
  };

  // ── Sizing ──
  const VW=240,VP=12,HH=44,SH=28,SG=4,VG=40;
  const CW=130,CH=52,EW=160,EH=44;
  const vH=v=>{const s=snFor(v),sv=svcFor(v);return HH+VP+Math.max(1,s.length)*(SH+SG)-SG+VP+(sv.length>0?8+24+VP:VP);};
  const rW=r=>Math.max(1,r.length)*(VW+VG)-VG;

  const PAD=30,TH=44;
  const iW=Math.max(rW(hV),rW(sV),300);
  const hasE=edges.length>0;
  const CX=PAD+(hasInet?CW+40:0)+(hasOnPrem?0:0);
  const oX=CX+iW+40;
  const eX=oX;
  const cW=Math.max(oX+(hasOnPrem||hasE?CW+PAD:PAD), CX+iW+PAD);
  const hY=TH+CH+50;
  const mHH=hV.length>0?Math.max(...hV.map(vH)):100;
  const sY=hY+mHH+60;
  const mSH=sV.length>0?Math.max(...sV.map(vH)):0;
  const edgeStartY=hY+mHH+20;
  const edgeTotalH=hasE?edges.length*(EH+8)-8:0;
  const bottomContent=Math.max(sV.length>0?sY+mSH:0, hasE?edgeStartY+edgeTotalH:0);
  const LH=36;
  const svgH=Math.max(bottomContent,hY+mHH)+LH+30;

  const hX0=CX+(iW-rW(hV))/2,sX0=CX+(iW-rW(sV))/2;
  const vP={};
  hV.forEach((v,i)=>{vP[v.name]={x:hX0+i*(VW+VG),y:hY};});
  sV.forEach((v,i)=>{vP[v.name]={x:sX0+i*(VW+VG),y:sY};});

  const iX=PAD;
  const fhp=hV.length>0?vP[hV[0].name]:null;
  const lhp=hV.length>0?vP[hV[hV.length-1].name]:null;
  const ECC={selfmanaged:"#F97316",equinix:"#EF4444",zscaler:"#3B82F6",platform:"#22C55E",megaport:"#EC4899",csp:"#A855F7",spoke:"#F97316"};

  // ── Transit match — returns ALL matching transits (edge can attach to multiple) ──
  const matchTransits=name=>{
    if(!name||hV.length===0)return [];
    // connected_transit may be comma-separated or contain multiple names
    const parts=name.split(/[,;|]/).map(s=>s.trim().toLowerCase()).filter(Boolean);
    const matched=new Set();
    for(const lo of parts){
      for(const v of hV){
        const vn=v.name.toLowerCase();
        if(vn===lo||vn.includes(lo)||lo.includes(vn))matched.add(v);
      }
    }
    // If single string didn't split, also try fuzzy match on whole string
    if(matched.size===0){
      const lo=name.toLowerCase();
      for(const v of hV){
        const vn=v.name.toLowerCase();
        if(vn.includes(lo)||lo.includes(vn))matched.add(v);
      }
    }
    return[...matched];
  };

  // ── Connection line (clean, no glow/animation) ──
  let connId=0;
  const Conn=({x1,y1,x2,y2,color,label,dashed})=>{
    const id=`cn-${connId++}`;
    const c=color||"#64748B";
    const mx=(x1+x2)/2,my=(y1+y2)/2;
    const lw=label?Math.max(50,label.length*5.2+16):0;
    const path=Math.abs(y1-y2)<4?`M${x1},${y1}L${x2},${y2}`:`M${x1},${y1} C${x1},${my} ${x2},${my} ${x2},${y2}`;
    return(<g>
      <defs><marker id={`${id}-ah`} viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse"><path d="M0 0L10 5L0 10z" fill={c}/></marker></defs>
      <path d={path} fill="none" stroke={c} strokeWidth="1.5" strokeDasharray={dashed?"5,4":"none"} markerEnd={`url(#${id}-ah)`}/>
      {label&&<g><rect x={mx-lw/2} y={my-9} width={lw} height={18} rx={3} fill={D.labelBg} stroke={D.labelBd} strokeWidth="0.8"/><text x={mx} y={my+3.5} textAnchor="middle" fill={D.sub} fontSize="7.5" fontWeight="600">{label}</text></g>}
    </g>);
  };

  // ── External node (Internet / On-Prem) ──
  const ExtNode=({x,y,color,icon,title,subtitle})=>(
    <g>
      <rect x={x} y={y} width={CW} height={CH} rx={8} fill={D.card} stroke={color} strokeWidth="1.5" style={{filter:`drop-shadow(0 2px 4px ${D.shadow})`}}/>
      <rect x={x} y={y} width={CW} height={4} rx={2} fill={color}/>
      <svg x={x+12} y={y+CH/2-8} width={18} height={18} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.8">{icon}</svg>
      <text x={x+36} y={y+CH/2-2} fill={D.text} fontSize="10" fontWeight="700">{title}</text>
      <text x={x+36} y={y+CH/2+10} fill={D.dim} fontSize="7">{subtitle}</text>
    </g>
  );

  // ── VPC Card (flat, clean) ──
  const VBox=({v})=>{
    const pos=vP[v.name];if(!pos)return null;
    const {x,y}=pos,h=vH(v),sns=snFor(v),svcs=svcFor(v);
    const isH=v.type==="transit";
    const isMgmt=v.type==="mgmt";
    const vp=vpcProv(v);
    const accent=isH?"#3B82F6":isMgmt?"#06B6D4":({aws:"#FF9900",azure:"#0078D4",gcp:"#34A853"}[vp]||PC);
    return(<g>
      {/* Card shadow + border */}
      <rect x={x} y={y} width={VW} height={h} rx={8} fill={D.card} stroke={D.cardBd} strokeWidth="1" style={{filter:`drop-shadow(0 2px 6px ${D.shadow})`}}/>
      {/* Top accent bar */}
      <rect x={x} y={y} width={VW} height={4} rx={2} fill={accent}/>
      {/* Header with per-VPC cloud icon */}
      <VpcIcon prov={vp} x={x+VP} y={y+6} sz={16}/>
      <text x={x+VP+20} y={y+20} fill={D.dim} fontSize="7" fontWeight="700" letterSpacing="0.8">{(v.type||"vpc").toUpperCase()}</text>
      <text x={x+VP} y={y+36} fill={D.text} fontSize="11" fontWeight="700">{tr(v.name,24)}</text>
      {v.cidr&&<text x={x+VW-VP} y={y+20} textAnchor="end" fill={D.dim} fontSize="7" fontFamily="monospace">{v.cidr}</text>}
      {v.gw_size&&<text x={x+VW-VP} y={y+36} textAnchor="end" fill={accent} fontSize="7.5" fontWeight="600" fontFamily="monospace">{v.gw_size}</text>}
      {/* Divider */}
      <line x1={x+VP} y1={y+HH} x2={x+VW-VP} y2={y+HH} stroke={D.cardBd} strokeWidth="0.8"/>
      {/* Subnets */}
      {(sns.length>0?sns:[{name:v.cidr||"Subnets",cidr:"",az:""}]).map((s,si)=>{
        const sy=y+HH+VP+si*(SH+SG);
        const pub=(s.name||"").toLowerCase().includes("pub");
        const sc=pub?"#22C55E":"#7C3AED";
        return(<g key={s.name||si}>
          <rect x={x+VP} y={sy} width={VW-VP*2} height={SH} rx={4} fill={dark?`${sc}10`:`${sc}08`} stroke={`${sc}30`} strokeWidth="0.8"/>
          <rect x={x+VP} y={sy} width={3} height={SH} rx={1.5} fill={sc}/>
          <text x={x+VP+10} y={sy+12} fill={sc} fontSize="8" fontWeight="600">{tr(s.name,22)}</text>
          <text x={x+VP+10} y={sy+22} fill={D.dim} fontSize="6.5" fontFamily="monospace">{tr((s.cidr||"")+(s.az?` · ${s.az}`:""),32)}</text>
        </g>);
      })}
      {/* Service badges with icons */}
      {svcs.length>0&&(()=>{
        const bY=y+h-VP-24;
        const bW=Math.floor((VW-VP*2-(svcs.length-1)*4)/svcs.length);
        return svcs.map((svc,si)=>{
          const bx=x+VP+si*(bW+4);
          const sc=svc.color;
          const icoSz=14;
          return(<g key={svc.label}>
            <rect x={bx} y={bY} width={bW} height={24} rx={4} fill={dark?`${sc}15`:`${sc}10`} stroke={`${sc}40`} strokeWidth="0.7"/>
            {svc.type==="avx-transit"&&<AvxTransitIco x={bx+4} y={bY+(24-icoSz)/2} sz={icoSz} c={sc}/>}
            {svc.type==="avx-spoke"&&<AvxSpokeIco x={bx+4} y={bY+(24-icoSz)/2} sz={icoSz} c={sc}/>}
            {svc.type==="fw"&&<FwLogo vendor={fw.vendor} x={bx+4} y={bY+(24-icoSz)/2} sz={icoSz}/>}
            {svc.type==="dcf"&&<Ico d={IC.dcf} x={bx+4+icoSz/2} y={bY+12} sz={icoSz} c={sc}/>}
            <text x={bx+icoSz+8} y={bY+15} fill={sc} fontSize="7" fontWeight="600">{svc.label}</text>
          </g>);
        });
      })()}
    </g>);
  };

  // ── Region box ──
  const allPos=Object.values(vP);
  const regionX=allPos.length>0?Math.min(...allPos.map(p=>p.x))-16:CX;
  const regionY=hY-28;
  const regionW=allPos.length>0?Math.max(...allPos.map(p=>p.x))+VW+16-regionX:300;
  const regionH=svgH-regionY-LH-15;

  // ── Legend ──
  const legend=[
    {c:"#3B82F6",l:"Transit"},{c:PC,l:"Spoke"},{c:"#22C55E",l:"Public"},{c:"#7C3AED",l:"Private"},
    hasInet&&{c:"#0891B2",l:"Internet"},hasOnPrem&&{c:"#7C3AED",l:"On-Prem"},
    fw.present&&{c:"#EC4899",l:fw.vendor?.split(" ")[0]||"Firewall"},
    edges.length>0&&{c:"#F97316",l:"Edge"},
  ].filter(Boolean);

  return(<Sec title="Network Diagram">
    {ao.description&&<p className="text-sm mb-4 leading-7" style={{color:AV.tm}}>{ao.description}</p>}
    <div style={{background:D.bg,borderRadius:12,border:`1px solid ${D.cardBd}`,overflow:"auto",boxShadow:`0 4px 16px ${D.shadow}`}}>
      <svg data-diagram-svg width={cW} height={svgH} viewBox={`0 0 ${cW} ${svgH}`} xmlns="http://www.w3.org/2000/svg" fontFamily="'Inter','SF Pro Display',system-ui,sans-serif">
        {/* Background */}
        <rect width={cW} height={svgH} fill={D.bg}/>

        {/* ─── Title Bar ─── */}
        <rect x={0} y={0} width={cW} height={TH} fill={dark?"#111827":"#F8FAFC"}/>
        <line x1={0} y1={TH} x2={cW} y2={TH} stroke={D.cardBd} strokeWidth="1"/>
        <ProvLogo prov={prov} x={PAD} y={(TH-20)/2} sz={20}/>
        <text x={PAD+26} y={TH/2+1} fill={D.text} fontSize="12" fontWeight="700">{doc.title||"Network Architecture"}</text>
        <text x={PAD+26} y={TH/2+12} fill={D.dim} fontSize="7.5" fontWeight="600" letterSpacing="0.5">{provName}</text>
        {ao.regions?.length>0&&ao.regions.map((r,ri)=>{const rx=cW-PAD-(ao.regions.length-ri)*(r.length*5.5+16);return(<g key={r}>
          <rect x={rx} y={(TH-16)/2} width={r.length*5.5+10} height={16} rx={3} fill={`${PC}15`} stroke={`${PC}30`} strokeWidth="0.7"/>
          <text x={rx+5} y={TH/2+3.5} fill={PC} fontSize="7" fontWeight="600">{r}</text>
        </g>);})}

        {/* ─── Cloud Region Container ─── */}
        {allPos.length>0&&<g>
          <rect x={regionX} y={regionY} width={regionW} height={regionH} rx={10} fill="none" stroke={`${PC}30`} strokeWidth="1" strokeDasharray="6,4"/>
          <rect x={regionX+12} y={regionY-8} width={provName.length*6+30} height={16} rx={3} fill={D.bg}/>
          <text x={regionX+20} y={regionY+3} fill={PC} fontSize="8" fontWeight="600" letterSpacing="0.5">{provName} Cloud</text>
        </g>}

        {/* ─── External: Internet ─── */}
        {hasInet&&<ExtNode x={iX} y={TH+10} color="#0891B2" title="Internet" subtitle="Public Network"
          icon={<g><circle cx="12" cy="12" r="10"/><path d="M2 12h20M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></g>}/>}

        {/* ─── External: On-Premises ─── */}
        {hasOnPrem&&<ExtNode x={oX} y={TH+10} color="#7C3AED" title="On-Premises" subtitle={prov==="azure"?"VPN / ExpressRoute":prov==="gcp"?"VPN / Interconnect":"VPN / DX / ER"}
          icon={<path d="M3 21h18M5 21V7l7-4 7 4v14M9 21v-4h6v4"/>}/>}

        {/* ─── Edge Devices ─── */}
        {(()=>{
          const nodes=[];
          edges.forEach((e,ei)=>{
            const ey=edgeStartY+ei*(EH+8),ec=ECC[e.type]||"#F97316";
            // Render edge card
            nodes.push(<g key={`eb-${e.name}`}>
              <rect x={eX} y={ey} width={EW} height={EH} rx={6} fill={D.card} stroke={D.cardBd} strokeWidth="1" style={{filter:`drop-shadow(0 1px 3px ${D.shadow})`}}/>
              <rect x={eX} y={ey} width={EW} height={3} rx={1.5} fill={ec}/>
              <Ico d={IC.edge} x={eX+14} y={ey+EH/2} sz={12} c={ec}/>
              <text x={eX+26} y={ey+16} fill={D.text} fontSize="8.5" fontWeight="700">{tr(e.name,18)}</text>
              <text x={eX+26} y={ey+28} fill={D.dim} fontSize="6.5">{e.type}{e.ha?" · HA":""}{e.size?` · ${e.size}`:""}</text>
              <text x={eX+26} y={ey+38} fill={D.dim} fontSize="6" opacity="0.6">{tr(e.location||"",26)}</text>
            </g>);
            // Draw connection to each matched transit (can be multiple)
            const targets=matchTransits(e.connected_transit);
            targets.forEach((tv,ti)=>{
              const tp=vP[tv.name];
              if(tp){
                const yOff=targets.length>1?(ti-(targets.length-1)/2)*8:0;
                nodes.push(<Conn key={`ea-${e.name}-${tv.name}`} x1={eX} y1={ey+EH/2} x2={tp.x+VW} y2={tp.y+vH(tv)/2+yOff} color="#F97316" label="Edge Attachment" dashed/>);
              }
            });
          });
          return nodes;
        })()}

        {/* ─── VPC Boxes ─── */}
        {hV.map(v=><VBox key={v.name} v={v}/>)}
        {sV.map(v=><VBox key={v.name} v={v}/>)}

        {/* ─── Connections ─── */}
        {/* Internet → transit(s) that have egress/internet evidence */}
        {hasInet&&(()=>{
          // Connect internet to first transit (egress is typically on primary transit)
          if(!fhp)return null;
          return<Conn x1={iX+CW} y1={TH+10+CH/2} x2={fhp.x} y2={fhp.y+vH(hV[0])/2} color="#0891B2" label="Internet Gateway" dashed/>;
        })()}
        {/* On-Prem → transit(s) with external connections, using local_gw to match */}
        {hasOnPrem&&(()=>{
          // Find which transits have external connections via local_gw field
          const extTransits=new Set();
          extConns.forEach(ec=>{
            if(ec.local_gw){
              const matched=matchTransits(ec.local_gw);
              matched.forEach(t=>extTransits.add(t.name));
            }
          });
          // Also check edge devices
          edges.forEach(e=>{
            if(e.connected_transit){
              matchTransits(e.connected_transit).forEach(t=>extTransits.add(t.name));
            }
          });
          // Derive connection label per transit based on provider/name/type
          const connLabel=tv=>{
            const n=tv.name.toLowerCase();
            // Check external_connections for this transit's type
            const ec=extConns.find(c=>c.local_gw&&n.includes(c.local_gw.toLowerCase())||c.local_gw&&c.local_gw.toLowerCase().includes(n.replace(/-/g,"")));
            const tp=ec?.tunnel_protocol||ec?.type||"";
            if(/expressroute|er\b/i.test(tp+n))return"ExpressRoute";
            if(/direct.connect|dx/i.test(tp+n))return"Direct Connect";
            if(n.includes("azure"))return"VPN / ER";
            if(n.includes("aws"))return"VPN / DX";
            if(n.includes("gcp"))return"VPN / Interconnect";
            return"VPN";
          };
          // If we found specific transits, connect to those; otherwise fallback to all transits
          const targets=extTransits.size>0?hV.filter(v=>extTransits.has(v.name)):hV;
          return targets.map((tv,ti)=>{
            const tp=vP[tv.name];if(!tp)return null;
            const yOff=targets.length>1?(ti-(targets.length-1)/2)*10:0;
            return<Conn key={`op-${tv.name}`} x1={oX} y1={TH+10+CH/2+yOff} x2={tp.x+VW} y2={tp.y+vH(tv)/2} color="#7C3AED" label={connLabel(tv)} dashed/>;
          });
        })()}
        {/* Spoke → Transit = "Spoke Attachment" (use connected_transit data, fallback to nearest) */}
        {sV.map(v=>{
          const sp=vP[v.name];if(!sp||hV.length===0)return null;
          // Use connected_transit field from AI analysis if available
          const targets=v.connected_transit?matchTransits(v.connected_transit):[];
          if(targets.length>0){
            return targets.map(tv=>{const tp=vP[tv.name];if(!tp)return null;return<Conn key={`s-${v.name}-${tv.name}`} x1={tp.x+VW/2} y1={tp.y+vH(tv)} x2={sp.x+VW/2} y2={sp.y} color={PC} label="Spoke Attachment"/>;});
          }
          // Fallback: nearest transit by position
          const nearest=hV.reduce((best,h)=>{const hp=vP[h.name];if(!hp)return best;const d=Math.abs((hp.x+VW/2)-(sp.x+VW/2));return(!best||d<best.d)?{h,hp,d}:best;},null);
          if(!nearest)return null;
          return<Conn key={`s-${v.name}`} x1={nearest.hp.x+VW/2} y1={nearest.hp.y+vH(nearest.h)} x2={sp.x+VW/2} y2={sp.y} color={PC} label="Spoke Attachment"/>;
        })}
        {/* Transit ↔ Transit = "Transit Peering" */}
        {hV.slice(0,-1).map((v,i)=>{const a=vP[v.name],b=vP[hV[i+1].name];if(!a||!b)return null;return<Conn key={`hh-${i}`} x1={a.x+VW} y1={a.y+vH(v)/2} x2={b.x} y2={b.y+vH(hV[i+1])/2} color="#3B82F6" label="Transit Peering"/>;})}

        {/* ─── Legend ─── */}
        <g transform={`translate(${PAD},${svgH-LH+4})`}>
          <line x1={-10} y1={-6} x2={cW-PAD*2+10} y2={-6} stroke={D.cardBd} strokeWidth="0.8"/>
          {legend.map(({c,l},i)=>{const lx=i*90;return(<g key={l}>
            <rect x={lx} y={2} width={8} height={8} rx={2} fill={c}/>
            <text x={lx+12} y={9} fill={D.dim} fontSize="7.5" fontWeight="600">{l}</text>
          </g>);})}
        </g>
      </svg>
    </div>
    {nd.routing&&<div className="mt-3 rounded-xl px-4 py-3 text-sm" style={{background:`${AV.or}08`,border:`1px solid ${AV.or}20`}}><span className="font-semibold" style={{color:AV.or}}>Routing: </span><span style={{color:AV.tm}}>{nd.routing}</span></div>}
  </Sec>);
}

// ── DOCX Export ────────────────────────────────────────────────────────────
function useDocx(){
  useEffect(()=>{
    if(window.docx)return;
    const s=window.document.createElement("script");
    s.src="https://cdn.jsdelivr.net/npm/docx@8.5.0/build/index.umd.min.js";
    window.document.head.appendChild(s);
  },[]);
}

function svgToPng(){
  return new Promise((resolve)=>{
    const svgEl=window.document.querySelector("[data-diagram-svg]");
    if(!svgEl){resolve(null);return;}
    const svgData=new XMLSerializer().serializeToString(svgEl);
    const canvas=window.document.createElement("canvas");
    const sc=2;
    canvas.width=svgEl.width.baseVal.value*sc;
    canvas.height=svgEl.height.baseVal.value*sc;
    const ctx=canvas.getContext("2d");
    const img=new Image();
    img.onload=()=>{ctx.fillStyle="#050B15";ctx.fillRect(0,0,canvas.width,canvas.height);ctx.drawImage(img,0,0,canvas.width,canvas.height);canvas.toBlob(b=>{const r=new FileReader();r.onload=()=>resolve({buf:r.result,w:canvas.width,h:canvas.height});r.readAsArrayBuffer(b);},"image/png");};
    img.onerror=()=>resolve(null);
    img.src="data:image/svg+xml;base64,"+btoa(unescape(encodeURIComponent(svgData)));
  });
}

function exportDocx(data,customerName){
  return new Promise(async(resolve,reject)=>{
    const D=window.docx;
    if(!D){
      const s=window.document.createElement("script");
      s.src="https://cdn.jsdelivr.net/npm/docx@8.5.0/build/index.umd.min.js";
      s.onload=()=>setTimeout(()=>exportDocx(data,customerName).then(resolve).catch(reject),400);
      s.onerror=()=>reject(new Error("Failed to load DOCX library"));
      window.document.head.appendChild(s);
      return;
    }
    try{
      const sf=v=>String(v||"—").slice(0,300);
      const ph=(t,l=1)=>new D.Paragraph({text:sf(t),heading:l===1?D.HeadingLevel.HEADING_1:l===2?D.HeadingLevel.HEADING_2:D.HeadingLevel.HEADING_3,spacing:{before:200,after:100}});
      const pp=t=>new D.Paragraph({children:[new D.TextRun({text:sf(t),size:22})],spacing:{after:120}});
      const kv=(k,v)=>v&&v!=="—"?new D.Paragraph({children:[new D.TextRun({text:`${k}: `,bold:true,size:22}),new D.TextRun({text:sf(v),size:22})],spacing:{after:80}}):null;
      const bl=t=>new D.Paragraph({children:[new D.TextRun({text:sf(t),size:22})],bullet:{level:0},spacing:{after:60}});
      const dv=()=>new D.Paragraph({border:{bottom:{color:"FF6B35",size:4,space:1,style:"single"}},spacing:{after:160}});
      const ch=[],add=item=>{if(item)ch.push(item);};

      // Table helper
      const HC="FF6B35",HBG="FFF3ED",BD="DDDDDD";
      const hCell=t=>new D.TableCell({children:[new D.Paragraph({children:[new D.TextRun({text:sf(t),bold:true,size:18,color:"FFFFFF",font:"Calibri"})],spacing:{after:0}})],shading:{fill:HC},borders:{top:{style:"single",size:1,color:BD},bottom:{style:"single",size:1,color:BD},left:{style:"single",size:1,color:BD},right:{style:"single",size:1,color:BD}},margins:{top:60,bottom:60,left:80,right:80}});
      const dCell=(t,opts={})=>new D.TableCell({children:[new D.Paragraph({children:[new D.TextRun({text:sf(t),size:18,bold:opts.bold||false,color:opts.color||"333333",font:opts.mono?"Courier New":"Calibri"})],spacing:{after:0}})],shading:opts.shade?{fill:HBG}:undefined,borders:{top:{style:"single",size:1,color:BD},bottom:{style:"single",size:1,color:BD},left:{style:"single",size:1,color:BD},right:{style:"single",size:1,color:BD}},margins:{top:50,bottom:50,left:80,right:80}});
      const mkTable=(headers,rows,widths)=>new D.Table({
        rows:[
          new D.TableRow({children:headers.map(h=>hCell(h)),tableHeader:true}),
          ...rows.map((r,ri)=>new D.TableRow({children:r.map((c,ci)=>dCell(c,{shade:ri%2===0,mono:ci===0}))}))
        ],
        width:{size:100,type:D.WidthType.PERCENTAGE},
        columnWidths:widths||headers.map(()=>Math.floor(9000/headers.length)),
      });

      // ── Title ──
      ch.push(new D.Paragraph({children:[new D.TextRun({text:data.title||"Infrastructure Design Document",bold:true,size:48,color:"FF6B35"})],spacing:{after:160}}));
      if(customerName)add(kv("Customer",customerName));
      add(kv("Version",data.version||"1.0")); add(kv("Date",new Date().toLocaleDateString("en-CA"))); add(kv("Provider",(data.provider||"").toUpperCase())); ch.push(dv());

      // ── 1. Executive Summary ──
      ch.push(ph("1. Executive Summary")); ch.push(pp(data.executive_summary)); ch.push(dv());

      // ── 2. Architecture Overview ──
      const ao=data.architecture_overview||{};
      ch.push(ph("2. Architecture Overview")); ch.push(pp(ao.description)); add(kv("Pattern",ao.pattern)); if(ao.regions?.length)add(kv("Regions",ao.regions.join(", ")));

      // Diagram image
      const diag=await svgToPng();
      if(diag){
        ch.push(new D.Paragraph({spacing:{before:200,after:200},children:[new D.ImageRun({data:diag.buf,transformation:{width:Math.min(620,diag.w/2),height:Math.min(400,diag.h/2)},type:"png"})]}));
      }
      ch.push(dv());

      // ── 3. Network Design ──
      const nd=data.network_design||{};
      ch.push(ph("3. Network Design")); if(nd.description)ch.push(pp(nd.description));

      // VPCs table
      if(nd.vpcs?.length){
        ch.push(ph("3.1 VPCs / VNets",2));
        ch.push(mkTable(
          ["Name","CIDR","Type","Gateway Size","Purpose"],
          nd.vpcs.map(v=>[v.name,v.cidr||"—",v.type||"—",v.gw_size||"—",v.purpose||"—"]),
          [2000,1500,1200,1800,2500]
        ));
      }

      // Subnets table
      if(nd.subnets?.length){
        ch.push(ph("3.2 Subnets",2));
        ch.push(mkTable(
          ["Name","CIDR","AZ","Purpose"],
          nd.subnets.map(s=>[s.name,s.cidr||"—",s.az||"—",s.purpose||"—"]),
          [2500,2000,1500,3000]
        ));
      }

      if(nd.routing){ch.push(ph("Routing",2));ch.push(pp(nd.routing));}
      if(nd.network_domains){ch.push(ph("Network Domains",2));ch.push(pp(nd.network_domains));}
      if(nd.connectivity){ch.push(ph("Connectivity",2));ch.push(pp(nd.connectivity));}
      ch.push(dv());

      // ── 4. Security ──
      const sec=data.security||{},fw=data.firewall_detail||{},dcf=data.dcf||{};
      ch.push(ph("4. Security Design")); if(sec.description)ch.push(pp(sec.description));
      if(fw.present){
        ch.push(ph("4.1 Firewall",2));
        ch.push(new D.Paragraph({children:[new D.TextRun({text:`${fw.vendor||"Firewall"} — ${fw.product||""}`,bold:true,size:24,color:"FF6B35"})],spacing:{after:80}}));
        const fwRows=[["Instance Size",fw.instance_size||fw.fw_size],["vCPUs",fw.vcpus],["Memory",fw.memory_gb?fw.memory_gb+" GB":null],["License Model",fw.license_model],["License Type",fw.license_type],["HA Mode",fw.ha_mode],["HA Instances",fw.ha_instances?String(fw.ha_instances):null],["Deployment",fw.deployment_mode],["Interfaces",fw.interfaces?.join(", ")],["Version",fw.version&&fw.version!=="unknown"?fw.version:null]].filter(([,v])=>v&&v!=="unknown"&&v!=="none");
        if(fwRows.length){
          ch.push(mkTable(["Property","Value"],fwRows,[3500,5500]));
        }
        if(fw.notes&&fw.notes!=="none")ch.push(pp(fw.notes));
      } else {ch.push(ph("4.1 Firewall",2));ch.push(pp(sec.firewall||"No dedicated firewall deployed."));}
      if(sec.encryption){ch.push(ph("4.2 Encryption",2));ch.push(pp(sec.encryption));}
      if(sec.access_control){ch.push(ph("4.3 Access Control",2));ch.push(pp(sec.access_control));}
      if(sec.inspection){ch.push(ph("4.4 Traffic Inspection",2));ch.push(pp(sec.inspection));}

      // DCF
      if(dcf.enabled){
        ch.push(ph("4.5 DCF Policies",2)); if(dcf.summary)ch.push(pp(dcf.summary));
        add(kv("Default Action",(dcf.default_action||"").toUpperCase())); add(kv("Egress",dcf.egress_enabled?"Enabled":"Disabled"));
        if(dcf.smart_groups?.length){
          ch.push(ph("SmartGroups",3));
          ch.push(mkTable(["Name","Filter Type","Members"],dcf.smart_groups.map(sg=>[sg.name,sg.filter_type||"—",(sg.members||[]).slice(0,6).join(", ")||"—"]),[2500,2000,4500]));
        }
        (dcf.rulesets||[]).forEach(rs=>{
          ch.push(ph(`Ruleset: ${rs.name||"Unnamed"}`,3));
          if(rs.rules?.length){
            ch.push(mkTable(["#","Name","Source","Destination","Proto","Port","Action"],rs.rules.map((r,i)=>[String(r.priority??i+1),r.name||"—",r.src||"Any",r.dst||"Any",r.protocol||"Any",r.port||"Any",(r.action||"—").toUpperCase()]),[600,1500,1500,1500,1000,1000,900]));
          }
        });
      }
      ch.push(dv());

      // ── 5. Edge Devices ──
      const edArr=data.edge_devices||[];
      if(edArr.length){
        ch.push(ph("5. Edge Devices"));
        ch.push(mkTable(["Name","Type","Location","Size","HA","Connected Transit","BGP ASN"],edArr.map(e=>[e.name,e.type||"—",e.location||"—",e.size||"—",e.ha?"Yes":"No",e.connected_transit||"—",e.bgp_asn||"—"]),[1800,1200,1200,1200,600,1500,1000]));
        ch.push(dv());
      }

      // ── 6. External Connections ──
      const extArr=data.external_connections||[];
      if(extArr.length){
        ch.push(ph("6. External Connections"));
        ch.push(mkTable(["Name","Type","Local GW","Remote IP","Tunnel","BGP ASN"],extArr.map(c=>[c.name,c.type||"—",c.local_gw||"—",c.remote_ip||"—",c.tunnel_protocol||"—",c.bgp_asn||"—"]),[2000,1000,1500,1500,1500,1000]));
        ch.push(dv());
      }

      // ── 7. Components ──
      ch.push(ph("7. Components"));
      if((data.components||[]).length){
        ch.push(mkTable(["Name","Type","Category","Purpose","Config"],
          (data.components||[]).map(c=>[c.name,c.type||"—",c.category||"—",c.purpose||"—",c.configuration||"—"]),
          [2000,1500,1200,2500,1800]));
      }
      ch.push(dv());

      // ── 8. Data Flows ──
      ch.push(ph("8. Data Flows"));
      (data.data_flows||[]).forEach(f=>{ch.push(ph(f.name,2));ch.push(pp(f.description));if(f.path?.length)ch.push(bl(f.path.join(" → ")));});
      ch.push(dv());

      // ── 9. Variables ──
      if((data.variables_and_parameters||[]).length){
        ch.push(ph("9. Variables"));
        ch.push(mkTable(["Name","Type/Value","Required","Purpose"],
          data.variables_and_parameters.map(v=>[v.name,v.value_or_type||"—",v.required?"Yes":"No",v.purpose||"—"]),
          [2500,2000,1000,3500]));
        ch.push(dv());
      }

      // ── 10. Outputs ──
      if((data.outputs||[]).length){
        ch.push(ph("10. Outputs"));
        ch.push(mkTable(["Name","Description","Consumed By"],
          data.outputs.map(o=>[o.name,o.description||"—",o.consumed_by||"—"]),
          [3000,4000,2000]));
        ch.push(dv());
      }

      // ── 11. Modules ──
      if((data.modules_used||[]).length){
        ch.push(ph("11. Modules"));
        ch.push(mkTable(["Name","Source","Version","Purpose"],
          data.modules_used.map(m=>[m.name,m.source||"—",m.version||"—",m.purpose||"—"]),
          [2000,3000,1000,3000]));
        ch.push(dv());
      }

      // ── 12. Deployment Notes ──
      ch.push(ph("12. Deployment Notes")); ch.push(pp(data.deployment_notes));
      if(data.provider_context)ch.push(pp(data.provider_context));
      if(data.firewall_context)ch.push(pp(data.firewall_context));

      const docxFile=new D.Document({
        creator:"Terraform Design Doc Generator",title:data.title||"IDD",
        sections:[{properties:{page:{margin:{top:1080,right:1080,bottom:1080,left:1080}}},children:ch.filter(Boolean)}],
        styles:{default:{document:{run:{font:"Calibri",size:22,color:"222222"}},heading1:{run:{font:"Calibri",size:32,bold:true,color:"FF6B35"}},heading2:{run:{font:"Calibri",size:26,bold:true,color:"1A2240"}},heading3:{run:{font:"Calibri",size:22,bold:true,color:"4A5A7A"}}}},
      });

      D.Packer.toBlob(docxFile).then(blob=>{
        const url=URL.createObjectURL(blob);
        const a=window.document.createElement("a");
        a.href=url; a.download=`${(data.title||"design-document").replace(/[^a-z0-9]+/gi,"-").toLowerCase()}.docx`; a.style.display="none";
        window.document.body.appendChild(a); a.click();
        setTimeout(()=>{window.document.body.removeChild(a);URL.revokeObjectURL(url);},1000);
        resolve();
      }).catch(reject);
    }catch(e){reject(e);}
  });
}

// ── MockFlow MCP Integration ──────────────────────────────────────────────
const MOCKFLOW_MCP="/api/mockflow";
const MF_COLORS={aws:{cloud:"#FF9900",pub:"#E8F5E9",priv:"#E3F2FD",data:"#FFF3E0"},azure:{cloud:"#0078D4",pub:"#E8F5E9",priv:"#E3F2FD",data:"#F3E5F5"},gcp:{cloud:"#4285F4",pub:"#E8F5E9",priv:"#E3F2FD",data:"#FFF8E1"}};

function buildMockFlowData(doc){
  const nd=doc.network_design||{},vpcs=nd.vpcs||[],subs=nd.subnets||[];
  const prov=doc.provider==="azure"?"azure":doc.provider==="gcp"?"gcloud":"aws";
  const diagramType=prov;
  const palette=MF_COLORS[prov==="gcloud"?"gcp":prov]||MF_COLORS.aws;
  const nodes=[],links=[];
  let nid=1;const id=()=>String(nid++);

  // Cloud group
  const cloudId=id();
  nodes.push({key:cloudId,text:prov==="azure"?"Azure Cloud":prov==="gcloud"?"Google Cloud":"AWS Cloud",isGroup:true,category:"cloud",fill:palette.cloud+"15",stroke:palette.cloud,loc:"0 0"});

  // VPC groups inside cloud
  const vpcMap={};
  const hubs=vpcs.filter(v=>v.type==="transit");
  const spokes=vpcs.filter(v=>v.type!=="transit");
  const allV=[...hubs,...spokes];

  allV.forEach((v,vi)=>{
    const vid=id();
    vpcMap[v.name]=vid;
    const x=vi*320,y=0;
    nodes.push({key:vid,text:v.name+(v.cidr?` (${v.cidr})`:""),isGroup:true,group:cloudId,category:"vpc",fill:v.type==="transit"?"#E3F2FD":"#F5F5F5",stroke:v.type==="transit"?"#1565C0":"#9E9E9E",loc:`${x} ${y}`});

    // Subnets for this VPC
    const vSubs=subs.filter(s=>s.vpc===v.name);
    if(vSubs.length){
      vSubs.forEach((s,si)=>{
        const sid=id();
        const isPub=/public|pub|dmz|nat/i.test(s.name)||/public/i.test(s.purpose||"");
        const sy=si*80+40;
        nodes.push({key:sid,text:s.name+(s.cidr?` ${s.cidr}`:""),isGroup:true,group:vid,category:"subnet",fill:isPub?palette.pub:palette.priv,stroke:isPub?"#4CAF50":"#1976D2",loc:`${x+20} ${sy}`});
      });
    }

    // Gateway node
    if(v.type==="transit"||v.gw_size){
      const gwId=id();
      const gwY=vSubs.length*80+60;
      nodes.push({key:gwId,text:(v.type==="transit"?"Transit GW":"Spoke GW")+` (${v.gw_size||"default"})`,group:vid,category:"service",fill:v.type==="transit"?"#BBDEFB":"#C8E6C9",stroke:v.type==="transit"?"#1565C0":"#388E3C",loc:`${x+40} ${gwY}`});
    }

    // FireNet node
    if(v.firenet===true&&doc.firewall_detail?.present){
      const fwId=id();
      const fwY=(vSubs.length||0)*80+120;
      const fwVendor=doc.firewall_detail.vendor||doc.firewall_vendor||"NGFW";
      nodes.push({key:fwId,text:`FireNet: ${fwVendor}`,group:vid,category:"service",fill:"#FFCDD2",stroke:"#E53935",loc:`${x+40} ${fwY}`});
    }
  });

  // Links: spoke → transit (spoke attachment)
  spokes.forEach(sv=>{
    const svId=vpcMap[sv.name];if(!svId)return;
    const target=sv.connected_transit?hubs.find(h=>h.name===sv.connected_transit)||hubs[0]:hubs[0];
    if(target&&vpcMap[target.name]){
      links.push({from:svId,to:vpcMap[target.name],text:"Spoke Attachment",stroke:"#FF6B35",strokeWidth:2});
    }
  });

  // Links: transit ↔ transit (peering)
  for(let i=0;i<hubs.length-1;i++){
    const a=vpcMap[hubs[i].name],b=vpcMap[hubs[i+1].name];
    if(a&&b)links.push({from:a,to:b,text:"Transit Peering",stroke:"#3B82F6",strokeWidth:2,strokeDashArray:"6 3"});
  }

  // Internet node
  const hasInet=vpcs.some(v=>v.type==="transit");
  if(hasInet){
    const inetId=id();
    nodes.push({key:inetId,text:"Internet",category:"external",fill:"#E0F7FA",stroke:"#00838F",loc:"-200 -100"});
    if(hubs[0]&&vpcMap[hubs[0].name])links.push({from:inetId,to:vpcMap[hubs[0].name],text:"Internet GW",stroke:"#0891B2",strokeDashArray:"4 4"});
  }

  // Edge devices
  (doc.edge_devices||[]).forEach((e,ei)=>{
    const eid=id();
    nodes.push({key:eid,text:`Edge: ${e.name}`,category:"external",fill:"#FFF3E0",stroke:"#F57C00",loc:`${-200} ${ei*100+100}`});
    if(e.connected_transit){
      const targets=e.connected_transit.split(",").map(s=>s.trim());
      targets.forEach(t=>{
        const hub=hubs.find(h=>h.name.toLowerCase().includes(t.toLowerCase()))||hubs.find(h=>t.toLowerCase().includes(h.name.toLowerCase()));
        if(hub&&vpcMap[hub.name])links.push({from:eid,to:vpcMap[hub.name],text:"Edge Attachment",stroke:"#F97316",strokeDashArray:"4 4"});
      });
    }
  });

  return{diagramType,nodeDataArray:nodes,linkDataArray:links};
}

async function callMockFlowMCP(doc){
  const payload=buildMockFlowData(doc);
  // Step 1: Initialize session
  const initResp=await fetch(MOCKFLOW_MCP,{
    method:"POST",headers:{"Content-Type":"application/json"},
    body:JSON.stringify({jsonrpc:"2.0",id:1,method:"initialize",params:{protocolVersion:"2024-11-05",capabilities:{},clientInfo:{name:"terraform-idd",version:"1.0.0"}}})
  });
  if(!initResp.ok)throw new Error(`MockFlow init failed: HTTP ${initResp.status}`);
  // Extract session header
  const sessionId=initResp.headers.get("mcp-session-id")||"";
  const headers={"Content-Type":"application/json"};
  if(sessionId)headers["mcp-session-id"]=sessionId;

  // Step 2: Send initialized notification
  await fetch(MOCKFLOW_MCP,{method:"POST",headers,body:JSON.stringify({jsonrpc:"2.0",method:"notifications/initialized"})});

  // Step 3: Call render_cloudarchitecture
  const callResp=await fetch(MOCKFLOW_MCP,{
    method:"POST",headers,
    body:JSON.stringify({jsonrpc:"2.0",id:2,method:"tools/call",params:{name:"render_cloudarchitecture",arguments:payload}})
  });
  if(!callResp.ok)throw new Error(`MockFlow call failed: HTTP ${callResp.status}`);
  const result=await callResp.json();
  if(result.error)throw new Error(result.error.message||JSON.stringify(result.error));

  // Parse result — content array with text items
  const content=result.result?.content||[];
  const textItem=content.find(c=>c.type==="text");
  if(textItem){
    try{
      const parsed=JSON.parse(textItem.text);
      return{url:parsed.url||"",thumbnailUrl:parsed.thumbnailUrl||"",title:parsed.title||"",success:parsed.success!==false};
    }catch{return{url:textItem.text,thumbnailUrl:"",title:"",success:true};}
  }
  throw new Error("No result from MockFlow");
}

// ── Mermaid Diagram ───────────────────────────────────────────────────────
function useMermaid(){
  useEffect(()=>{
    if(window.mermaid)return;
    const s=window.document.createElement("script");
    s.src="https://cdn.jsdelivr.net/npm/mermaid@11/dist/mermaid.min.js";
    s.onload=()=>window.mermaid?.initialize({startOnLoad:false,theme:"dark",themeVariables:{primaryColor:"#1A2240",primaryTextColor:"#F0F4FF",primaryBorderColor:"#3B82F6",lineColor:"#FF6B35",secondaryColor:"#0F1628",tertiaryColor:"#1E2D50"}});
    window.document.head.appendChild(s);
  },[]);
}

function buildMermaid(doc){
  const nd=doc.network_design||{},vpcs=nd.vpcs||[];
  const fw=doc.firewall_detail||{};
  const edges=doc.edge_devices||[];
  const extConns=doc.external_connections||[];
  const hubs=vpcs.filter(v=>v.type==="transit");
  const spokes=vpcs.filter(v=>v.type!=="transit");
  // Sanitize node IDs and labels
  const sid=s=>s.replace(/[^a-zA-Z0-9]/g,"_");
  const lines=["flowchart TB"];

  // Internet node
  const hasInet=hubs.length>0;
  if(hasInet)lines.push(`  INET((("Internet")))`);

  // On-Prem node
  const hasOnPrem=extConns.length>0||edges.length>0;
  if(hasOnPrem)lines.push(`  ONPREM[/"On-Premises"\\]`);

  // Cloud subgraph
  const provLabel=doc.provider==="azure"?"Azure Cloud":doc.provider==="gcp"?"Google Cloud":"AWS Cloud";
  lines.push(`  subgraph CLOUD["${provLabel}"]`);
  lines.push("    direction TB");

  // Transit VPCs
  hubs.forEach(v=>{
    const id=sid(v.name);
    lines.push(`    subgraph ${id}["${v.name}${v.cidr?" · "+v.cidr:""}"]`);
    lines.push("      direction LR");
    lines.push(`      ${id}_gw[/"Transit GW${v.gw_size?" · "+v.gw_size:""}"/]`);
    if(v.firenet===true&&fw.present){
      const fwV=fw.vendor||doc.firewall_vendor||"NGFW";
      lines.push(`      ${id}_fw{{"FireNet: ${fwV}"}}`);
      lines.push(`      ${id}_gw --- ${id}_fw`);
    }
    // Subnets in this VPC
    const vSubs=(nd.subnets||[]).filter(s=>s.vpc===v.name);
    vSubs.forEach(s=>{
      const subId=sid(v.name+"_"+s.name);
      lines.push(`      ${subId}["${s.name}${s.cidr?" · "+s.cidr:""}"]`);
    });
    lines.push("    end");
  });

  // Spoke VPCs
  spokes.forEach(v=>{
    const id=sid(v.name);
    lines.push(`    subgraph ${id}["${v.name}${v.cidr?" · "+v.cidr:""}"]`);
    lines.push("      direction LR");
    lines.push(`      ${id}_gw[/"Spoke GW${v.gw_size?" · "+v.gw_size:""}"/]`);
    const vSubs=(nd.subnets||[]).filter(s=>s.vpc===v.name);
    vSubs.forEach(s=>{
      const subId=sid(v.name+"_"+s.name);
      lines.push(`      ${subId}["${s.name}${s.cidr?" · "+s.cidr:""}"]`);
    });
    lines.push("    end");
  });

  lines.push("  end");

  // Edge devices
  edges.forEach(e=>{
    const eid=sid("edge_"+e.name);
    lines.push(`  ${eid}[["Edge: ${e.name}${e.location?" · "+e.location:""}"]]\n`);
  });

  // Connections: Internet → transits
  if(hasInet&&hubs[0])lines.push(`  INET -.-|"Internet GW"| ${sid(hubs[0].name)}`);

  // Connections: On-Prem → transits
  if(hasOnPrem&&hubs.length>0){
    const target=hubs[hubs.length-1]||hubs[0];
    lines.push(`  ONPREM -.-|"VPN / DX"| ${sid(target.name)}`);
  }

  // Connections: Transit ↔ Transit peering
  for(let i=0;i<hubs.length-1;i++){
    lines.push(`  ${sid(hubs[i].name)} ===|"Transit Peering"| ${sid(hubs[i+1].name)}`);
  }

  // Connections: Spoke → Transit
  spokes.forEach(sv=>{
    const target=sv.connected_transit?hubs.find(h=>h.name===sv.connected_transit)||hubs[0]:hubs[0];
    if(target)lines.push(`  ${sid(target.name)} -->|"Spoke Attachment"| ${sid(sv.name)}`);
  });

  // Connections: Edge → Transit
  edges.forEach(e=>{
    const eid=sid("edge_"+e.name);
    if(e.connected_transit){
      const targets=e.connected_transit.split(",").map(s=>s.trim());
      targets.forEach(t=>{
        const hub=hubs.find(h=>h.name.toLowerCase().includes(t.toLowerCase()))||hubs[0];
        if(hub)lines.push(`  ${eid} -.-|"Edge Attachment"| ${sid(hub.name)}`);
      });
    }else if(hubs[0]){
      lines.push(`  ${eid} -.-|"Edge Attachment"| ${sid(hubs[0].name)}`);
    }
  });

  // Styling
  lines.push("");
  lines.push("  classDef transit fill:#1E3A5F,stroke:#3B82F6,color:#F0F4FF,stroke-width:2px");
  lines.push("  classDef spoke fill:#1A2240,stroke:#FF6B35,color:#F0F4FF,stroke-width:1px");
  lines.push("  classDef ext fill:#0F1628,stroke:#0891B2,color:#67E8F9");
  lines.push("  classDef onprem fill:#0F1628,stroke:#7C3AED,color:#C4B5FD");
  lines.push("  classDef edge fill:#1E2D50,stroke:#F97316,color:#FDBA74");
  hubs.forEach(v=>lines.push(`  class ${sid(v.name)} transit`));
  spokes.forEach(v=>lines.push(`  class ${sid(v.name)} spoke`));
  if(hasInet)lines.push("  class INET ext");
  if(hasOnPrem)lines.push("  class ONPREM onprem");
  edges.forEach(e=>lines.push(`  class ${sid("edge_"+e.name)} edge`));

  return lines.join("\n");
}

// ── ZIP helpers ────────────────────────────────────────────────────────────
const VE=[".tf",".tfvars"];
const isV=n=>VE.some(e=>n.endsWith(e));
const isM=n=>n.includes("__MACOSX")||n.includes(".DS_Store");
function useJSZip(){useEffect(()=>{if(window.JSZip)return;const s=window.document.createElement("script");s.src="https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js";window.document.head.appendChild(s);},[]);}

// ── Doc Viewer ─────────────────────────────────────────────────────────────
function DocView({doc,selModel,dark,onExport}){
  useMermaid();
  const [tab,setTab]=useState("overview");
  const [exporting,setExporting]=useState(false);
  const [mfLoading,setMfLoading]=useState(false);
  const [mfResult,setMfResult]=useState(null);
  const [mfError,setMfError]=useState(null);
  const [diagMode,setDiagMode]=useState("svg");
  const [mmSvg,setMmSvg]=useState("");
  const [mmErr,setMmErr]=useState(null);
  const mmRef=useRef(null);
  const tabs=[{id:"overview",l:"Overview"},{id:"network",l:"Network"},{id:"security",l:"Security"},{id:"dcf",l:"DCF Policies"},{id:"edge",l:"Edge & Ext"},{id:"components",l:"Components"},{id:"diagram",l:"Diagram"},{id:"flows",l:"Data Flows"},{id:"variables",l:"Variables"}];
  const nd=doc.network_design||{},ao=doc.architecture_overview||{},sec=doc.security||{},fw=doc.firewall_detail||{},dcf=doc.dcf||{};
  const edgeDevs=doc.edge_devices||[],extConns=doc.external_connections||[];
  const PC={aws:"#FF9900",azure:"#0078D4",gcp:"#34A853",multi:AV.pu,unknown:AV.tm}[doc.provider]||AV.tm;
  const fwColor={palo_alto:"#FA582D",fortinet:"#EE2722",checkpoint:"#E2002A",cisco:"#1BA0D7"}[doc.firewall_vendor]||AV.or;
  const fwLabel={palo_alto:"Palo Alto Networks",fortinet:"Fortinet",checkpoint:"Check Point",cisco:"Cisco",none:"No Firewall",unknown:"Unknown"}[doc.firewall_vendor]||"Firewall";
  const noFw=!doc.firewall_vendor||doc.firewall_vendor==="none"||doc.firewall_vendor==="unknown";
  const acC={allow:"#22C55E",deny:"#EC4899","force-drop":"#EF4444",unknown:AV.tm};
  const mL=AVAILABLE_MODELS.find(m=>m.value===selModel)?.label||selModel;
  const edTC={selfmanaged:"#F97316",equinix:"#EF4444",zscaler:"#3B82F6",platform:"#22C55E",megaport:"#EC4899",csp:"#A855F7",spoke:"#FF6B35"};

  const TabIntro=({text})=><p className="text-sm mb-6 leading-relaxed" style={{color:AV.tm,borderLeft:`3px solid ${AV.or}30`,paddingLeft:12}}>{text}</p>;

  const doExport=async()=>{
    setExporting(true);
    try{await onExport();}
    catch(e){alert("Export failed: "+e.message);}
    finally{setTimeout(()=>setExporting(false),1500);}
  };

  return(<div className="rounded-2xl overflow-hidden" style={{background:AV.nm,border:`1px solid ${AV.nb}`}}>
    {/* Header */}
    <div style={{background:AV.nv,borderBottom:`1px solid ${AV.nb}`,padding:"2rem"}}>
      <div style={{height:3,background:`linear-gradient(90deg,${AV.or},${AV.pu})`,borderRadius:2,marginBottom:"1.5rem"}}/>
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="flex-1">
          <div className="flex flex-wrap gap-2 mb-3">
            <span style={{background:`${PC}22`,border:`1px solid ${PC}55`,color:PC}} className="text-xs font-bold uppercase tracking-widest rounded-full px-3 py-1">{(doc.provider||"?").toUpperCase()}</span>
            <span style={{background:`${AV.or}15`,border:`1px solid ${AV.or}40`,color:AV.or}} className="text-xs font-bold rounded-full px-3 py-1">v{doc.version||"1.0"}</span>
            <span style={{background:"#ffffff10",border:`1px solid ${AV.nb}`,color:AV.tm}} className="text-xs rounded-full px-3 py-1">{new Date().toLocaleDateString("en-CA")}</span>
          </div>
          <h1 className="text-3xl font-black mb-3" style={{color:AV.tp}}>{doc.title}</h1>
          <p className="text-sm leading-7 max-w-2xl" style={{color:AV.tm}}>{doc.executive_summary}</p>
        </div>
        <button onClick={doExport} disabled={exporting} className="flex items-center gap-2 px-5 py-3 rounded-xl font-bold text-sm text-white shrink-0 disabled:opacity-60" style={{background:`linear-gradient(135deg,${AV.or},${AV.pu})`,boxShadow:`0 4px 16px ${AV.or}30`}}>
          {exporting?<><svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 12a9 9 0 1 1-6.22-8.56"/></svg>Exporting…</>:<><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-4 h-4"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>Export DOCX</>}
        </button>
      </div>
      <div className="flex flex-wrap gap-4 mt-6 text-xs" style={{color:AV.tm}}>
        <span><strong style={{color:AV.tp}}>Pattern:</strong> {ao.pattern||"—"}</span>
        {ao.regions?.length>0&&<span><strong style={{color:AV.tp}}>Regions:</strong> {ao.regions.join(", ")}</span>}
        <span><strong style={{color:AV.tp}}>Components:</strong> {doc.components?.length||0}</span>
        {!noFw&&<span><strong style={{color:AV.tp}}>Firewall:</strong> {fwLabel}</span>}
        {dcf.enabled&&<span><strong style={{color:"#A855F7"}}>DCF:</strong> Enabled</span>}
        {edgeDevs.length>0&&<span><strong style={{color:"#F97316"}}>Edge:</strong> {edgeDevs.length}</span>}
      </div>
    </div>

    {/* Tabs */}
    <div className="flex overflow-x-auto" style={{background:AV.nv,borderBottom:`1px solid ${AV.nb}`}}>
      {tabs.map(t=><button key={t.id} onClick={()=>setTab(t.id)} style={tab===t.id?{color:AV.or,borderBottom:`2px solid ${AV.or}`,background:`${AV.or}0A`}:{color:AV.tm,borderBottom:"2px solid transparent"}} className="px-5 py-3 text-sm font-semibold whitespace-nowrap">{t.l}</button>)}
    </div>

    <div className="p-6" style={{background:AV.nm}}>

      {tab==="overview"&&<div className="space-y-6">
        <TabIntro text="High-level summary of the infrastructure architecture, including the design pattern, cloud provider strategy, compute resources, and deployment considerations."/>
        <Sec title="Architecture Overview"><Pr t={ao.description}/>{ao.diagram_description&&<div className="mt-3 rounded-lg px-4 py-3 text-sm italic" style={{background:`${AV.or}08`,border:`1px solid ${AV.or}20`,color:AV.tm}}>📐 {ao.diagram_description}</div>}</Sec>
        {doc.compute?.description&&<Sec title="Compute Summary"><Pr t={doc.compute.description}/></Sec>}
        {doc.deployment_notes&&<Sec title="Deployment Notes"><Pr t={doc.deployment_notes}/>{doc.provider_context&&<Pr t={doc.provider_context}/>}</Sec>}
      </div>}

      {tab==="network"&&<div className="space-y-6">
        <TabIntro text="Network topology extracted from your Terraform configuration, including VPCs/VNets, CIDR allocations, subnet layout, gateway instance sizes, routing model, and Network Domains."/>
        {nd.description&&<Sec title="Network Topology"><Pr t={nd.description}/></Sec>}
        {nd.vpcs?.length>0&&<Sec title="VPCs / VNets"><div className="grid gap-3">{nd.vpcs.map((v,i)=><div key={i} className="rounded-xl px-4 py-3" style={{background:AV.nl,border:`1px solid ${AV.nb}`}}><div className="font-bold text-sm mb-1" style={{color:AV.or}}>{v.name}</div><div className="grid grid-cols-2 gap-1"><KV k="CIDR" v={v.cidr}/><KV k="Type" v={v.type}/><KV k="Gateway Size" v={v.gw_size}/></div><Pr t={v.purpose}/></div>)}</div></Sec>}
        {nd.subnets?.length>0&&<Sec title="Subnets"><div className="overflow-x-auto rounded-xl" style={{border:`1px solid ${AV.nb}`}}><table className="w-full text-sm"><thead style={{background:AV.nl}}><tr>{["Name","CIDR","AZ","Purpose"].map(h=><th key={h} className="px-4 py-2 text-left text-xs font-bold uppercase tracking-wider" style={{color:AV.tm}}>{h}</th>)}</tr></thead><tbody>{nd.subnets.map((s,i)=><tr key={i} style={{borderTop:`1px solid ${AV.nb}`}}><td className="px-4 py-2 font-mono text-xs" style={{color:AV.or}}>{s.name}</td><td className="px-4 py-2 font-mono text-xs" style={{color:"#60A5FA"}}>{s.cidr||"—"}</td><td className="px-4 py-2 text-xs" style={{color:AV.tm}}>{s.az||"—"}</td><td className="px-4 py-2 text-xs" style={{color:AV.tm}}>{s.purpose}</td></tr>)}</tbody></table></div></Sec>}
        {nd.routing&&<Sec title="Routing"><Pr t={nd.routing}/></Sec>}
        {nd.network_domains&&<Sec title="Network Domains"><Pr t={nd.network_domains}/></Sec>}
        {nd.connectivity&&<Sec title="Connectivity"><Pr t={nd.connectivity}/></Sec>}
      </div>}

      {tab==="security"&&<div className="space-y-6">
        <TabIntro text="Security architecture including firewall deployment details (vendor, sizing, licensing, HA mode), encryption standards, access control policies, and traffic inspection strategy."/>
        {sec.description&&<Sec title="Security Posture"><Pr t={sec.description}/></Sec>}
        <Sec title="Firewall">
          {fw.present?(()=>{
            const fwSize=fw.instance_size||fw.fw_size||null;
            const fwStats=[
              fwSize&&{icon:"📦",label:"Instance Size",value:fwSize},
              fw.vcpus&&{icon:"⚙",label:"vCPUs",value:fw.vcpus},
              fw.memory_gb&&{icon:"🧠",label:"Memory",value:fw.memory_gb+" GB"},
              fw.ha_instances&&{icon:"🔄",label:"HA Instances",value:String(fw.ha_instances)},
            ].filter(Boolean);
            const fwMeta=[
              fw.license_type&&fw.license_type!=="unknown"&&fw.license_type!=="none"&&["License Type",fw.license_type],
              fw.deployment_mode&&fw.deployment_mode!=="unknown"&&fw.deployment_mode!=="none"&&["Deployment",fw.deployment_mode],
              fw.version&&fw.version!=="unknown"&&fw.version!=="none"&&["Version",fw.version],
            ].filter(Boolean);
            return(<div className="rounded-2xl overflow-hidden" style={{border:`1px solid ${fwColor}40`}}>
              {/* Header */}
              <div className="px-6 py-5" style={{background:`linear-gradient(135deg,${fwColor}15,${fwColor}05)`,borderBottom:`1px solid ${fwColor}25`}}>
                <div className="flex items-center gap-4 flex-wrap">
                  <div className="w-12 h-12 rounded-xl flex items-center justify-center text-2xl" style={{background:`${fwColor}20`,border:`1px solid ${fwColor}40`,boxShadow:`0 4px 12px ${fwColor}15`}}>🔥</div>
                  <div className="flex-1">
                    <div className="font-black text-xl" style={{color:fwColor}}>{fw.vendor||"Firewall"}</div>
                    <div className="text-sm mt-0.5" style={{color:AV.tm}}>{fw.product||"—"}</div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {fw.license_model&&fw.license_model!=="unknown"&&<span className="text-xs px-3 py-1.5 rounded-lg font-bold uppercase tracking-wide" style={{background:`${fwColor}18`,border:`1px solid ${fwColor}40`,color:fwColor}}>{fw.license_model}</span>}
                    {fw.ha_mode&&fw.ha_mode!=="unknown"&&<span className="text-xs px-3 py-1.5 rounded-lg font-bold uppercase tracking-wide" style={{background:"#22C55E12",border:"1px solid #22C55E35",color:"#4ADE80"}}>{fw.ha_mode}</span>}
                  </div>
                </div>
              </div>
              {/* Stats row */}
              {fwStats.length>0&&<div className="flex flex-wrap" style={{borderBottom:`1px solid ${AV.nb}`}}>
                {fwStats.map((s,i)=><div key={s.label} className="flex-1 min-w-[120px] px-5 py-4" style={{background:AV.nm,borderRight:i<fwStats.length-1?`1px solid ${AV.nb}`:"none"}}>
                  <div className="flex items-center gap-1.5 mb-1.5"><span className="text-xs">{s.icon}</span><span className="text-xs font-bold uppercase tracking-wider" style={{color:AV.tm}}>{s.label}</span></div>
                  <div className="text-lg font-black font-mono" style={{color:AV.tp}}>{s.value}</div>
                </div>)}
              </div>}
              {/* Meta details */}
              {fwMeta.length>0&&<div className="px-6 py-3 flex flex-wrap gap-x-6 gap-y-1" style={{background:AV.nm,borderBottom:`1px solid ${AV.nb}`}}>
                {fwMeta.map(([l,v])=><div key={l} className="flex items-center gap-2 text-sm"><span className="font-semibold" style={{color:AV.tm}}>{l}:</span><span style={{color:AV.tp}}>{v}</span></div>)}
              </div>}
              {/* Interfaces */}
              {fw.interfaces?.length>0&&<div className="px-6 py-4" style={{background:AV.nm,borderBottom:`1px solid ${AV.nb}`}}>
                <div className="text-xs font-bold uppercase tracking-wider mb-2.5" style={{color:AV.tm}}>Network Interfaces</div>
                <div className="flex flex-wrap gap-2">{fw.interfaces.map((f,i)=>{
                  const ic={management:"🔧",lan:"🔗",egress:"🌐",wan:"📡"}[f.toLowerCase()]||"🔌";
                  return<span key={i} className="text-xs px-3 py-1.5 rounded-lg font-mono font-semibold flex items-center gap-1.5" style={{background:`${fwColor}10`,border:`1px solid ${fwColor}30`,color:fwColor}}><span className="text-[10px]">{ic}</span>{f}</span>;
                })}</div>
              </div>}
              {/* Notes */}
              {fw.notes&&fw.notes!=="none"&&<div className="px-6 py-3 text-sm" style={{background:`${AV.nm}`,color:AV.tm}}>
                <span className="font-semibold" style={{color:AV.td}}>Notes: </span>{fw.notes}
              </div>}
              {/* Firewall context */}
              {doc.firewall_context&&<div className="px-6 py-3 text-sm italic" style={{background:`${fwColor}06`,borderTop:`1px solid ${fwColor}15`,color:AV.tm}}>{doc.firewall_context}</div>}
            </div>);
          })():<Pr t={sec.firewall||"No dedicated firewall deployed."}/>}
        </Sec>
        {sec.encryption&&<Sec title="Encryption"><Pr t={sec.encryption}/></Sec>}
        {sec.access_control&&<Sec title="Access Control"><Pr t={sec.access_control}/></Sec>}
        {sec.inspection&&<Sec title="Traffic Inspection"><Pr t={sec.inspection}/></Sec>}
      </div>}

      {tab==="dcf"&&<div className="space-y-6">
        <TabIntro text="Aviatrix Distributed Cloud Firewall (DCF) configuration — microsegmentation policies that control east-west and egress traffic using SmartGroups, WebGroups, and rule-based enforcement across your multi-cloud network."/>
        <div className="rounded-xl px-5 py-4 flex flex-wrap items-center gap-4" style={{background:`${AV.or}08`,border:`1px solid ${AV.or}25`}}>
          <div><div className="flex items-center gap-2 mb-1"><span className="text-lg">🛡️</span><span className="font-black text-lg" style={{color:AV.tp}}>Aviatrix DCF</span><span className="text-xs px-2 py-0.5 rounded-full font-bold" style={dcf.enabled?{background:"#22C55E15",border:"1px solid #22C55E40",color:"#4ADE80"}:{background:"#EC489915",border:"1px solid #EC489940",color:"#F472B6"}}>{dcf.enabled?"ENABLED":"NOT DETECTED"}</span></div>{dcf.summary&&<p className="text-sm" style={{color:AV.tm}}>{dcf.summary}</p>}</div>
          <div className="ml-auto flex flex-wrap gap-2">
            {[["Default Action",dcf.default_action,dcf.default_action==="deny"?"#22C55E":dcf.default_action==="allow"?"#EAB308":"#EC4899"],dcf.egress_enabled&&["Egress","On","#3B82F6"],dcf.tls_decryption_enabled&&["TLS","On","#A855F7"],dcf.kubernetes_enabled&&["K8s","On","#F97316"]].filter(Boolean).map(([l,v,c])=><div key={l} className="flex flex-col items-center rounded-lg px-3 py-2" style={{background:`${c}15`,border:`1px solid ${c}35`}}><span className="text-xs uppercase font-bold tracking-wider" style={{color:AV.tm}}>{l}</span><span className="text-sm font-bold capitalize" style={{color:c}}>{v||"—"}</span></div>)}
          </div>
        </div>
        {dcf.enabled&&dcf.default_action!=="deny"&&<div className="rounded-xl px-4 py-3 text-sm flex items-start gap-2" style={{background:"#EAB30810",border:"1px solid #EAB30840"}}><span style={{color:"#EAB308"}}>⚠</span><span style={{color:AV.tm}}><strong style={{color:"#FCD34D"}}>{dcf.default_action==="allow"?"Default Action is PERMIT — not zero-trust.":"Default Action unknown."}</strong> Set to DENY using <code style={{color:AV.or}}>aviatrix_distributed_firewalling_default_action_rule</code>.</span></div>}
        {!dcf.enabled&&<div className="rounded-xl px-4 py-6 text-center" style={{background:AV.nl,border:`1px solid ${AV.nb}`}}><div className="text-4xl mb-3">🔒</div><p className="font-semibold" style={{color:AV.tp}}>No DCF policies detected</p></div>}
        {dcf.smart_groups?.length>0&&<Sec title={`SmartGroups (${dcf.smart_groups.length})`}><div className="grid gap-3 sm:grid-cols-2">{dcf.smart_groups.map((sg,i)=><div key={i} className="rounded-xl px-4 py-3" style={{background:AV.nl,border:`1px solid ${AV.nb}`}}><div className="flex items-center gap-2 mb-1"><span className="font-bold text-sm" style={{color:"#60A5FA"}}>{sg.name}</span><span className="text-xs px-2 py-0.5 rounded" style={{background:"#3B82F615",color:"#93C5FD"}}>{sg.filter_type}</span></div><div className="flex flex-wrap gap-1 mt-1">{(sg.members||[]).slice(0,6).map((m,j)=><span key={j} className="text-xs px-2 py-0.5 rounded font-mono" style={{background:"#3B82F610",border:"1px solid #3B82F630",color:"#93C5FD"}}>{m}</span>)}{sg.members?.length>6&&<span className="text-xs" style={{color:AV.tm}}>+{sg.members.length-6} more</span>}</div></div>)}</div></Sec>}
        {dcf.web_groups?.length>0&&<Sec title={`WebGroups (${dcf.web_groups.length})`}><div className="grid gap-3 sm:grid-cols-2">{dcf.web_groups.map((wg,i)=><div key={i} className="rounded-xl px-4 py-3" style={{background:AV.nl,border:`1px solid ${AV.nb}`}}><div className="font-bold text-sm mb-2" style={{color:"#A855F7"}}>{wg.name}</div><div className="flex flex-wrap gap-1">{(wg.domains||[]).slice(0,8).map((d,j)=><span key={j} className="text-xs px-2 py-0.5 rounded font-mono" style={{background:"#A855F710",border:"1px solid #A855F730",color:"#C084FC"}}>{d}</span>)}</div></div>)}</div></Sec>}
        {dcf.rulesets?.length>0&&dcf.rulesets.map((rs,ri)=><Sec key={ri} title={`${rs.name||"Ruleset"} (${rs.rules?.length||0} rules)`}><div className="overflow-x-auto rounded-xl" style={{border:`1px solid ${AV.nb}`}}><table className="w-full text-xs"><thead style={{background:AV.nl}}><tr>{["#","Name","Src","Dst","Proto","Port","Action","Log","TLS"].map(h=><th key={h} className="px-3 py-2 text-left font-bold uppercase whitespace-nowrap" style={{color:AV.tm}}>{h}</th>)}</tr></thead><tbody>{(rs.rules||[]).map((r,rj)=>{const ac=acC[r.action]||AV.tm;return(<tr key={rj} style={{borderTop:`1px solid ${AV.nb}`}}><td className="px-3 py-2 font-mono" style={{color:AV.td}}>{r.priority??rj+1}</td><td className="px-3 py-2 font-semibold" style={{color:AV.tp}}>{r.name||"—"}</td><td className="px-3 py-2 font-mono" style={{color:"#60A5FA"}}>{r.src||"Any"}</td><td className="px-3 py-2 font-mono" style={{color:"#A855F7"}}>{r.dst||"Any"}</td><td className="px-3 py-2" style={{color:AV.tm}}>{r.protocol||"Any"}</td><td className="px-3 py-2 font-mono" style={{color:AV.tm}}>{r.port||"Any"}</td><td className="px-3 py-2"><span className="px-2 py-0.5 rounded-full font-bold uppercase text-xs" style={{background:`${ac}15`,border:`1px solid ${ac}40`,color:ac}}>{r.action||"—"}</span></td><td className="px-3 py-2 text-center">{r.logging?<span style={{color:"#22C55E"}}>✓</span>:<span style={{color:AV.td}}>—</span>}</td><td className="px-3 py-2 text-center">{r.tls_decryption?<span style={{color:"#A855F7"}}>✓</span>:<span style={{color:AV.td}}>—</span>}</td></tr>);})}</tbody></table></div></Sec>)}
      </div>}

      {tab==="edge"&&<div className="space-y-6">
        <TabIntro text="Edge gateways deployed at on-premises or colocation sites, and external BGP/IPsec connections to third-party networks. Edge devices connect to transit gateways to extend the cloud fabric to physical locations."/>
        {edgeDevs.length>0&&<Sec title={`Edge Devices (${edgeDevs.length})`}><div className="grid gap-3 sm:grid-cols-2">{edgeDevs.map((e,i)=>{const ec=edTC[e.type]||AV.or;return(<div key={i} className="rounded-xl overflow-hidden" style={{border:`1px solid ${ec}40`}}><div className="px-4 py-3 flex items-center gap-3" style={{background:`${ec}10`,borderBottom:`1px solid ${ec}30`}}><div className="w-8 h-8 rounded-lg flex items-center justify-center text-base" style={{background:`${ec}20`}}>⚡</div><div><div className="font-bold text-sm" style={{color:ec}}>{e.name}</div><div className="text-xs" style={{color:AV.tm}}>{e.type}{e.ha?" · HA":""}</div></div></div><div className="px-4 py-3 space-y-1" style={{background:AV.nm}}><KV k="Location" v={e.location}/><KV k="Size" v={e.size}/><KV k="WAN" v={e.wan}/><KV k="LAN" v={e.lan}/><KV k="Connected Transit" v={e.connected_transit}/><KV k="BGP ASN" v={e.bgp_asn}/></div></div>);})}</div></Sec>}
        {extConns.length>0&&<Sec title={`External Connections (${extConns.length})`}><div className="grid gap-3">{extConns.map((c,i)=><div key={i} className="rounded-xl px-4 py-3" style={{background:AV.nl,border:`1px solid ${AV.nb}`}}><div className="font-bold text-sm mb-2" style={{color:AV.or}}>{c.name}</div><div className="grid grid-cols-2 gap-1"><KV k="Type" v={c.type}/><KV k="Tunnel" v={c.tunnel_protocol}/><KV k="Local GW" v={c.local_gw}/><KV k="Remote IP" v={c.remote_ip}/><KV k="BGP ASN" v={c.bgp_asn}/></div></div>)}</div></Sec>}
        {edgeDevs.length===0&&extConns.length===0&&<div className="rounded-xl px-4 py-6 text-center" style={{background:AV.nl,border:`1px solid ${AV.nb}`}}><div className="text-4xl mb-3">📡</div><p className="font-semibold" style={{color:AV.tp}}>No edge devices or external connections detected</p></div>}
      </div>}

      {tab==="components"&&<div className="space-y-6"><TabIntro text="All infrastructure components identified in the Terraform configuration, categorized by function (compute, network, storage, security, etc.) with their dependencies and configuration details."/><Sec title={`Components (${doc.components?.length||0})`}><div className="space-y-3">{(doc.components||[]).map((c,i)=>{const ct=CAT_TW[c.category]||CAT_TW.other;return(<div key={i} className={`rounded-xl border ${ct.bd} ${ct.bg} px-4 py-4`}><div className="flex flex-wrap items-center gap-2 mb-2"><span className={`font-bold ${ct.tx}`}>{c.name}</span><code className="text-xs rounded px-2 py-0.5 font-mono" style={{background:"#ffffff08",color:AV.tm,border:`1px solid ${AV.nb}`}}>{c.type}</code><span className={`text-xs px-2 py-0.5 rounded-full capitalize border ${ct.bd} ${ct.tx}`}>{c.category}</span></div><Pr t={c.purpose}/>{c.configuration&&<p className="text-xs mt-2 font-mono" style={{color:AV.tm}}>⚙ {c.configuration}</p>}{c.dependencies?.length>0&&<p className="text-xs mt-1" style={{color:AV.td}}>↳ {c.dependencies.join(", ")}</p>}</div>);})}</div></Sec></div>}

      {/* Always render diagram so SVG is in DOM for DOCX export */}
      <div style={tab==="diagram"?{}:{position:"absolute",left:"-9999px",top:0,opacity:0,pointerEvents:"none"}}>
        {tab==="diagram"&&<>
          <TabIntro text="Visual network topology showing transit gateways, spoke VPCs, firewall and DCF placement, edge device connections, and internet/on-prem connectivity paths."/>
          {/* Diagram mode toggle */}
          <div className="flex items-center gap-2 mb-4">
            <div className="flex rounded-xl overflow-hidden" style={{border:`1px solid ${AV.nb}`}}>
              <button onClick={()=>setDiagMode("svg")} className="flex items-center gap-2 px-4 py-2 text-sm font-semibold transition-all" style={diagMode==="svg"?{background:`${AV.or}18`,color:AV.or,borderRight:`1px solid ${AV.nb}`}:{background:AV.nl,color:AV.tm,borderRight:`1px solid ${AV.nb}`}}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-4 h-4"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18M9 21V9"/></svg>
                SVG Diagram
              </button>
              <button onClick={()=>{
                setDiagMode("mermaid");
                if(!mmSvg&&!mmErr){
                  const code=buildMermaid(doc);
                  const tryRender=()=>{
                    if(!window.mermaid){setTimeout(tryRender,300);return;}
                    window.mermaid.render("mm-"+Date.now(),code).then(({svg})=>setMmSvg(svg)).catch(e=>setMmErr(e.message||"Mermaid render failed"));
                  };
                  tryRender();
                }
              }} className="flex items-center gap-2 px-4 py-2 text-sm font-semibold transition-all" style={diagMode==="mermaid"?{background:"#22C55E18",color:"#4ADE80",borderRight:`1px solid ${AV.nb}`}:{background:AV.nl,color:AV.tm,borderRight:`1px solid ${AV.nb}`}}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-4 h-4"><path d="M22 12h-4l-3 9L9 3l-3 9H2"/></svg>
                Mermaid
              </button>
              <button onClick={()=>{
                setDiagMode("mockflow");
                if(!mfResult&&!mfLoading&&!mfError){
                  setMfLoading(true);setMfError(null);
                  callMockFlowMCP(doc).then(r=>setMfResult(r)).catch(e=>setMfError(e.message)).finally(()=>setMfLoading(false));
                }
              }} className="flex items-center gap-2 px-4 py-2 text-sm font-semibold transition-all" style={diagMode==="mockflow"?{background:"#3B82F618",color:"#60A5FA"}:{background:AV.nl,color:AV.tm}}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-4 h-4"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/></svg>
                MockFlow
                <span className="text-xs px-1.5 py-0.5 rounded" style={{background:"#3B82F615",color:"#60A5FA",fontSize:9,fontWeight:700}}>BETA</span>
              </button>
            </div>
          </div>
        </>}
        {/* SVG diagram — always rendered for DOCX export, hidden when other mode active */}
        <div style={diagMode!=="svg"&&tab==="diagram"?{display:"none"}:{}}>
          <Diagram doc={doc} dark={dark}/>
        </div>
        {/* Mermaid view */}
        {tab==="diagram"&&diagMode==="mermaid"&&<div>
          {!mmSvg&&!mmErr&&<div className="rounded-xl p-12 text-center" style={{background:AV.nl,border:`1px solid ${AV.nb}`}}>
            <svg className="animate-spin w-8 h-8 mx-auto mb-4" style={{color:"#22C55E"}} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 12a9 9 0 1 1-6.22-8.56"/></svg>
            <p className="font-semibold" style={{color:AV.tp}}>Rendering Mermaid diagram...</p>
          </div>}
          {mmErr&&<div className="rounded-xl p-6" style={{background:AV.nl,border:`1px solid ${AV.nb}`}}>
            <div className="rounded-lg px-4 py-3 text-sm mb-4" style={{background:"#EC489910",border:"1px solid #EC489940",color:"#F9A8D4"}}>{mmErr}</div>
            <button onClick={()=>{
              setMmSvg("");setMmErr(null);
              const code=buildMermaid(doc);
              window.mermaid?.render("mm-"+Date.now(),code).then(({svg})=>setMmSvg(svg)).catch(e=>setMmErr(e.message||"Mermaid render failed"));
            }} className="flex items-center gap-2 px-4 py-2 rounded-xl font-bold text-sm text-white" style={{background:"#22C55E"}}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-4 h-4"><path d="M23 4v6h-6"/><path d="M1 20v-6h6"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/></svg>
              Retry
            </button>
          </div>}
          {mmSvg&&<div>
            <div className="rounded-xl overflow-auto p-4" style={{background:dark?"#0D1117":"#FAFBFC",border:`1px solid ${AV.nb}`}} ref={mmRef} dangerouslySetInnerHTML={{__html:mmSvg}}/>
            <div className="flex items-center justify-between mt-3">
              <p className="text-xs" style={{color:AV.tm}}>Rendered with Mermaid.js — flowchart from IDD network data</p>
              <button onClick={()=>{
                setMmSvg("");setMmErr(null);
                const code=buildMermaid(doc);
                window.mermaid?.render("mm-"+Date.now(),code).then(({svg})=>setMmSvg(svg)).catch(e=>setMmErr(e.message||"Mermaid render failed"));
              }} className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold" style={{background:AV.nl,border:`1px solid ${AV.nb}`,color:AV.tm}}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-3.5 h-3.5"><path d="M23 4v6h-6"/><path d="M1 20v-6h6"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/></svg>
                Regenerate
              </button>
            </div>
          </div>}
        </div>}
        {/* MockFlow view */}
        {tab==="diagram"&&diagMode==="mockflow"&&<div>
          {mfLoading&&<div className="rounded-xl p-12 text-center" style={{background:AV.nl,border:`1px solid ${AV.nb}`}}>
            <svg className="animate-spin w-8 h-8 mx-auto mb-4" style={{color:"#3B82F6"}} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 12a9 9 0 1 1-6.22-8.56"/></svg>
            <p className="font-semibold" style={{color:AV.tp}}>Generating MockFlow diagram...</p>
            <p className="text-sm mt-1" style={{color:AV.tm}}>Creating interactive cloud architecture on IdeaBoard</p>
          </div>}
          {mfError&&<div className="rounded-xl p-6" style={{background:AV.nl,border:`1px solid ${AV.nb}`}}>
            <div className="rounded-lg px-4 py-3 text-sm mb-4" style={{background:"#EC489910",border:"1px solid #EC489940",color:"#F9A8D4"}}>{mfError}</div>
            <button onClick={()=>{
              setMfLoading(true);setMfError(null);setMfResult(null);
              callMockFlowMCP(doc).then(r=>setMfResult(r)).catch(e=>setMfError(e.message)).finally(()=>setMfLoading(false));
            }} className="flex items-center gap-2 px-4 py-2 rounded-xl font-bold text-sm text-white" style={{background:"#3B82F6"}}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-4 h-4"><path d="M23 4v6h-6"/><path d="M1 20v-6h6"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/></svg>
              Retry
            </button>
          </div>}
          {mfResult&&mfResult.success&&<div className="rounded-xl overflow-hidden" style={{border:`1px solid #3B82F640`}}>
            {mfResult.thumbnailUrl&&<div className="p-4" style={{background:"#3B82F608"}}><img src={mfResult.thumbnailUrl} alt="MockFlow Cloud Architecture" className="w-full rounded-lg" style={{maxHeight:500,objectFit:"contain"}}/></div>}
            <div className="flex items-center justify-between flex-wrap gap-3 px-5 py-4" style={{background:AV.nm,borderTop:`1px solid #3B82F630`}}>
              <div>
                <div className="text-sm font-semibold" style={{color:AV.tp}}>{mfResult.title||"Cloud Architecture Diagram"}</div>
                <p className="text-xs mt-0.5" style={{color:AV.tm}}>Interactive diagram — edit, annotate, and share on MockFlow</p>
              </div>
              <div className="flex items-center gap-2">
                <button onClick={()=>{
                  setMfLoading(true);setMfError(null);setMfResult(null);
                  callMockFlowMCP(doc).then(r=>setMfResult(r)).catch(e=>setMfError(e.message)).finally(()=>setMfLoading(false));
                }} className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-semibold" style={{background:AV.nl,border:`1px solid ${AV.nb}`,color:AV.tm}}>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-3.5 h-3.5"><path d="M23 4v6h-6"/><path d="M1 20v-6h6"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/></svg>
                  Regenerate
                </button>
                {mfResult.url&&<a href={mfResult.url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 px-4 py-2 rounded-lg font-bold text-sm text-white" style={{background:"#3B82F6",boxShadow:"0 2px 8px #3B82F630"}}>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-4 h-4"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
                  Open in MockFlow
                </a>}
              </div>
            </div>
          </div>}
          {!mfLoading&&!mfError&&!mfResult&&<div className="rounded-xl p-8 text-center" style={{background:AV.nl,border:`1px solid ${AV.nb}`}}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-12 h-12 mx-auto mb-3" style={{color:"#3B82F6"}}><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/></svg>
            <p className="font-semibold mb-1" style={{color:AV.tp}}>MockFlow Cloud Architecture</p>
            <p className="text-sm mb-4" style={{color:AV.tm}}>Generate an interactive, editable diagram on MockFlow IdeaBoard</p>
            <button onClick={()=>{
              setMfLoading(true);setMfError(null);
              callMockFlowMCP(doc).then(r=>setMfResult(r)).catch(e=>setMfError(e.message)).finally(()=>setMfLoading(false));
            }} className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold text-sm text-white" style={{background:"linear-gradient(135deg,#3B82F6,#8B5CF6)",boxShadow:"0 2px 12px #3B82F630"}}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-4 h-4"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/></svg>
              Generate Diagram
            </button>
          </div>}
        </div>}
      </div>

      {tab==="flows"&&<div className="space-y-6"><TabIntro text="Traffic and data flow paths through the infrastructure, showing how requests traverse from source to destination across gateways, firewalls, and network segments."/><Sec title="Traffic & Data Flows"><div className="space-y-5">{(doc.data_flows||[]).map((f,i)=><div key={i} className="rounded-xl px-4 py-4" style={{background:AV.nl,border:`1px solid ${AV.nb}`}}><div className="font-bold mb-2" style={{color:AV.or}}>{f.name}</div><Pr t={f.description}/>{f.path?.length>0&&<div className="mt-3 flex flex-wrap items-center gap-1">{f.path.map((p,j)=><span key={j} className="flex items-center gap-1"><span className="text-xs px-2 py-1 rounded font-mono" style={{background:`${AV.pu}20`,color:"#C084FC",border:`1px solid ${AV.pu}30`}}>{p}</span>{j<f.path.length-1&&<span style={{color:AV.or}}>→</span>}</span>)}</div>}</div>)}</div></Sec></div>}

      {tab==="variables"&&<div className="space-y-6">
        <TabIntro text="Terraform variables, outputs, and modules used in the configuration. Variables control the deployment parameters, outputs expose values for consumption by other configurations or CI/CD pipelines."/>
        {doc.variables_and_parameters?.length>0&&<Sec title="Variables"><div className="overflow-x-auto rounded-xl" style={{border:`1px solid ${AV.nb}`}}><table className="w-full text-sm"><thead style={{background:AV.nl}}><tr>{["Name","Type","Required","Purpose"].map(h=><th key={h} className="px-4 py-2 text-left text-xs font-bold uppercase tracking-wider" style={{color:AV.tm}}>{h}</th>)}</tr></thead><tbody>{doc.variables_and_parameters.map((v,i)=><tr key={i} style={{borderTop:`1px solid ${AV.nb}`}}><td className="px-4 py-2 font-mono font-semibold text-xs" style={{color:AV.or}}>{v.name}</td><td className="px-4 py-2 text-xs"><code style={{color:"#C084FC"}}>{v.value_or_type}</code></td><td className="px-4 py-2 text-xs"><span style={v.required?{color:"#F472B6"}:{color:"#4ADE80"}}>{v.required?"Required":"Optional"}</span></td><td className="px-4 py-2 text-xs" style={{color:AV.tm}}>{v.purpose}</td></tr>)}</tbody></table></div></Sec>}
        {doc.outputs?.length>0&&<Sec title="Outputs"><div className="grid gap-3">{doc.outputs.map((o,i)=><div key={i} className="rounded-xl px-4 py-3" style={{background:AV.nl,border:`1px solid ${AV.nb}`}}><code className="text-sm font-bold" style={{color:AV.or}}>{o.name}</code><p className="text-sm mt-1" style={{color:AV.tm}}>{o.description}</p>{o.consumed_by&&<p className="text-xs mt-1" style={{color:AV.td}}>Consumed by: {o.consumed_by}</p>}</div>)}</div></Sec>}
        {doc.modules_used?.length>0&&<Sec title="Modules"><div className="space-y-3">{doc.modules_used.map((m,i)=><div key={i} className="rounded-xl px-4 py-3" style={{background:`${AV.pu}10`,border:`1px solid ${AV.pu}30`}}><div className="font-bold text-sm" style={{color:"#C084FC"}}>{m.name}</div><code className="text-xs" style={{color:AV.tm}}>{m.source}{m.version&&m.version!=="unknown"?` @ ${m.version}`:""}</code><Pr t={m.purpose}/></div>)}</div></Sec>}
      </div>}

    </div>

    <div className="px-6 py-4 flex justify-between items-center text-xs" style={{background:AV.nv,borderTop:`1px solid ${AV.nb}`,color:AV.td}}>
      <div className="flex items-center gap-2 flex-wrap">
        <span>Infrastructure Design Document · Terraform source</span>
        <span className="px-2 py-0.5 rounded-full font-mono font-bold" style={{background:`${AV.or}15`,border:`1px solid ${AV.or}35`,color:AV.or}}>v{APP_VERSION}</span>
        <span className="px-2 py-0.5 rounded-full font-mono" style={{background:`${AV.pu}15`,border:`1px solid ${AV.pu}35`,color:"#C084FC"}}>{mL}</span>
      </div>
      <button onClick={doExport} className="flex items-center gap-1 text-xs font-semibold" style={{color:AV.or}}>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-3 h-3"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
        Export DOCX
      </button>
    </div>
  </div>);
}

// ── App ────────────────────────────────────────────────────────────────────
export default function App(){
  useJSZip(); useDocx();
  const [selModel,setSelModel]=useState(()=>sg("tf_doc_model")||APP_MODEL_DEFAULT);
  const [apiKey,  setApiKey]  =useState(()=>sg("tf_doc_apikey")||"");
  const [keySet,  setKeySet]  =useState(true);
  const [keyInput,setKeyInput]=useState(()=>sg("tf_doc_apikey")||"");
  const [showKey, setShowKey] =useState(false);
  const [files,   setFiles]   =useState([]);
  const [loading, setLoading] =useState(false);
  const [extr,    setExtr]    =useState(false);
  const [doc,     setDoc]     =useState(null);
  const [error,   setError]   =useState(null);
  const [debug,   setDebug]   =useState(null);
  const [drag,    setDrag]    =useState(false);
  const [progress,setProgress]=useState({step:0,label:""});
  const [custName,setCustName]=useState(()=>sg("tf_doc_cust")||"");
  const [dark,    setDark]    =useState(()=>sg("tf_doc_dark")!=="false");
  AV=dark?DARK:LIGHT;
  const toggleDark=()=>{const next=!dark;setDark(next);ss("tf_doc_dark",String(next));};
  const progTimer=useRef(null);
  const ref=useRef();

  const readText=f=>new Promise((res,rej)=>{const r=new FileReader();r.onload=()=>res({name:f.name,path:f.name,content:r.result});r.onerror=()=>rej(new Error("Read failed"));r.readAsText(f);});

  const extractZip=useCallback(async file=>{
    const getLib=()=>new Promise((res,rej)=>{if(window.JSZip)return res(window.JSZip);let n=0;const t=setInterval(()=>{if(window.JSZip){clearInterval(t);res(window.JSZip);}else if(++n>25){clearInterval(t);rej(new Error("JSZip not loaded"));}},200);});
    const Lib=await getLib();const loaded=await new Lib().loadAsync(file);const all=[];
    loaded.forEach((path,entry)=>{if(!entry.dir)all.push({path,entry});});
    const valid=all.filter(({path})=>isV(path)&&!isM(path));
    if(!valid.length){setError(`No .tf files. Extensions: ${[...new Set(all.map(({path})=>"."+path.split(".").pop()))].join(", ")}`);return [];}
    return Promise.all(valid.map(({path,entry})=>entry.async("string").then(content=>({name:path.split("/").pop(),path,content}))));
  },[]);

  const handleFiles=useCallback(async nf=>{
    setError(null);setExtr(true);const added=[];let err=null;
    for(const f of Array.from(nf)){
      if(f.name.endsWith(".zip")){try{const ex=await extractZip(f);added.push(...ex);}catch(e){err="ZIP: "+e.message;setError(err);}}
      else if(isV(f.name)){try{added.push(await readText(f));}catch(e){err=e.message;setError(err);}}
    }
    setExtr(false);
    if(added.length)setFiles(p=>[...p,...added]);
    else if(!err)setError("No .tf or .tfvars files found.");
  },[extractZip]);

  const onDrop=useCallback(e=>{e.preventDefault();setDrag(false);handleFiles(e.dataTransfer.files);},[handleFiles]);

  const progSteps=[
    {at:0,label:"Preparing files…"},
    {at:5,label:"Sending to Claude…"},
    {at:15,label:"Analyzing Terraform configuration…"},
    {at:35,label:"Mapping network topology…"},
    {at:55,label:"Evaluating security policies…"},
    {at:75,label:"Generating design document…"},
    {at:90,label:"Finalizing…"},
  ];
  const startProgress=()=>{
    let i=0;setProgress({step:0,label:progSteps[0].label});
    if(progTimer.current)clearInterval(progTimer.current);
    progTimer.current=setInterval(()=>{
      i++;if(i>=progSteps.length){clearInterval(progTimer.current);return;}
      setProgress({step:progSteps[i].at,label:progSteps[i].label});
    },3000);
  };
  const stopProgress=(success)=>{
    if(progTimer.current)clearInterval(progTimer.current);
    progTimer.current=null;
    setProgress({step:success?100:0,label:success?"Done":""});
  };

  const analyze=async()=>{
    setLoading(true);setError(null);setDoc(null);setDebug(null);
    startProgress();
    const dbg={step:"start",apiStatus:null,stopReason:"",statusMsg:"",apiBody:""};
    try{
      const combined=files.map(f=>`### FILE: ${f.path}\n\`\`\`hcl\n${f.content}\n\`\`\``).join("\n\n");
      dbg.step="fetch";let resp;
      try{const custCtx=custName.trim()?`\nCustomer: ${custName.trim()}. Use this as the customer name in the title and throughout the document.`:"";resp=await fetch(API_URL,{method:"POST",headers:{"Content-Type":"application/json","x-api-key":apiKey,"anthropic-version":"2023-06-01"},body:JSON.stringify({model:selModel,max_tokens:16000,system:SYS,messages:[{role:"user",content:`Generate a formal Infrastructure Design Document JSON from these Terraform files. Be concise:${custCtx}\n\n${combined}`}]})});}
      catch(fe){dbg.step="fetch_failed";dbg.statusMsg=fe.message;setDebug({...dbg});setError("Network error: "+fe.message);stopProgress(false);setLoading(false);return;}
      dbg.apiStatus=resp.status;dbg.step="read_body";
      const bt=await resp.text();dbg.apiBody=bt.slice(0,600);
      if(!resp.ok){setDebug({...dbg});setError(`API HTTP ${resp.status}: ${bt.slice(0,300)}`);stopProgress(false);setLoading(false);return;}
      let data;try{data=JSON.parse(bt);}catch(je){setDebug({...dbg});setError("Parse error: "+je.message);stopProgress(false);setLoading(false);return;}
      if(data.error){setDebug({...dbg});setError("API error: "+JSON.stringify(data.error));stopProgress(false);setLoading(false);return;}
      const raw=(data.content?.map(b=>b.text||"").join("")||"").replace(/```json|```/g,"").trim();
      dbg.stopReason=data.stop_reason||"";
      if(!raw){setDebug({...dbg});setError("Empty response");stopProgress(false);setLoading(false);return;}
      let parsed;
      try{parsed=JSON.parse(raw);}
      catch(pe){try{let f=raw;f=f.replace(/,\s*"[^"]*"\s*:\s*[^,}\]]*$/,"").replace(/,\s*"[^"]*$/,"").replace(/"[^"]*$/,'"..."');let ob=(f.match(/\{/g)||[]).length-(f.match(/\}/g)||[]).length,ab=(f.match(/\[/g)||[]).length-(f.match(/\]/g)||[]).length;while(ab-->0)f+="]";while(ob-->0)f+="}";parsed=JSON.parse(f);}catch(re){setDebug({...dbg});setError(`JSON parse failed: ${pe.message}\n${raw.slice(0,400)}`);stopProgress(false);setLoading(false);return;}}
      dbg.step="done";setDebug({...dbg});stopProgress(true);setDoc(parsed);
    }catch(e){dbg.statusMsg=e.message;setDebug({...dbg});setError("Unexpected: "+e.message);stopProgress(false);}
    setLoading(false);
  };

  const grouped=files.reduce((a,f)=>{const p=(f.path||f.name).split("/");const folder=p.length>1?p.slice(0,-1).join("/"):"(root)";(a[folder]=a[folder]||[]).push(f);return a;},{});

  if(!keySet)return(
    <div className="min-h-screen p-4 sm:p-8" style={{background:AV.nv}}>
      <div style={{position:"fixed",top:"10%",left:"15%",width:400,height:400,background:`radial-gradient(circle,${AV.or}15 0%,transparent 70%)`,pointerEvents:"none"}}/>
      <div style={{position:"fixed",bottom:"10%",right:"10%",width:350,height:350,background:`radial-gradient(circle,${AV.pu}18 0%,transparent 70%)`,pointerEvents:"none"}}/>
      <div className="max-w-lg mx-auto relative mt-16">
        <div className="text-center mb-8"><h1 className="text-4xl font-black mb-3" style={{color:AV.tp}}>Infrastructure <span style={{background:`linear-gradient(90deg,${AV.or},${AV.pu})`,WebkitBackgroundClip:"text",WebkitTextFillColor:"transparent"}}>Design Doc</span></h1><p style={{color:AV.tm}}>Enter your Anthropic API key to get started</p></div>
        <div className="rounded-2xl p-6" style={{background:AV.nm,border:`1px solid ${AV.nb}`}}>
          <label className="block text-sm font-semibold mb-2" style={{color:AV.tp}}>Anthropic API Key</label>
          <div className="relative mb-4"><input type={showKey?"text":"password"} placeholder="sk-ant-api03-..." value={keyInput} onChange={e=>setKeyInput(e.target.value)} onKeyDown={e=>{if(e.key==="Enter"&&keyInput.startsWith("sk-")){ss("tf_doc_apikey",keyInput);setApiKey(keyInput);setKeySet(true);}}} className="w-full rounded-xl px-4 py-3 text-sm font-mono pr-16" style={{background:AV.nl,border:`1px solid ${AV.nb}`,color:AV.tp,outline:"none"}}/><button onClick={()=>setShowKey(s=>!s)} className="absolute right-3 top-3 text-xs px-2 py-1 rounded" style={{color:AV.tm,background:AV.nb}}>{showKey?"Hide":"Show"}</button></div>
          <p className="text-xs mb-5" style={{color:AV.tm}}>Key stored in memory only. Get yours at <a href="https://console.anthropic.com" target="_blank" rel="noopener noreferrer" style={{color:AV.or}}>console.anthropic.com</a>.</p>
          <button onClick={()=>{if(keyInput.startsWith("sk-")){ss("tf_doc_apikey",keyInput);setApiKey(keyInput);setKeySet(true);}}} disabled={!keyInput.startsWith("sk-")} className="w-full py-3 rounded-xl font-bold text-white disabled:opacity-40 disabled:cursor-not-allowed" style={{background:`linear-gradient(135deg,${AV.or},${AV.pu})`}}>Continue →</button>
        </div>
      </div>
    </div>
  );

  return(
    <div className="min-h-screen p-4 sm:p-8" style={{background:AV.nv}}>
      <div style={{position:"fixed",top:"10%",left:"15%",width:400,height:400,background:`radial-gradient(circle,${AV.or}15 0%,transparent 70%)`,pointerEvents:"none",zIndex:0}}/>
      <div style={{position:"fixed",bottom:"10%",right:"10%",width:350,height:350,background:`radial-gradient(circle,${AV.pu}18 0%,transparent 70%)`,pointerEvents:"none",zIndex:0}}/>
      <div className="max-w-5xl mx-auto relative" style={{zIndex:1}}>
        <div className="text-center mb-10">
          <div className="inline-flex items-center gap-2 rounded-full px-4 py-1.5 text-sm font-medium mb-5" style={{background:`${AV.or}15`,border:`1px solid ${AV.or}40`,color:AV.or}}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-4 h-4"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
            Terraform Design Document Generator
          </div>
          <h1 className="text-5xl font-black mb-3" style={{color:AV.tp}}>Infrastructure <span style={{background:`linear-gradient(90deg,${AV.or},${AV.pu})`,WebkitBackgroundClip:"text",WebkitTextFillColor:"transparent"}}>Design Doc</span></h1>
          <p style={{color:AV.tm}}>Upload Terraform files → formal design document → export as <strong style={{color:AV.or}}>DOCX</strong></p>
          <div className="flex items-center justify-center gap-3 mt-3 flex-wrap">
            <span className="text-xs px-2 py-0.5 rounded-full font-mono font-bold" style={{background:`${AV.or}15`,border:`1px solid ${AV.or}35`,color:AV.or}}>v{APP_VERSION}</span>
            <select value={selModel} onChange={e=>{setSelModel(e.target.value);ss("tf_doc_model",e.target.value);}} className="text-xs rounded-full px-3 py-0.5 font-mono cursor-pointer" style={{background:`${AV.pu}15`,border:`1px solid ${AV.pu}35`,color:"#C084FC",outline:"none"}}>
              {AVAILABLE_MODELS.map(m=><option key={m.value} value={m.value} style={{background:AV.nm,color:AV.tp}}>{m.label}</option>)}
            </select>
            <button onClick={()=>{sd("tf_doc_apikey");setKeySet(false);setKeyInput("");setApiKey("");}} className="text-xs" style={{color:AV.td}}>🔑 Change API key</button>
            <button onClick={toggleDark} className="text-xs px-3 py-0.5 rounded-full font-medium" style={{background:`${AV.tp}10`,border:`1px solid ${AV.nb}`,color:AV.tm}}>{dark?"☀ Light":"🌙 Dark"}</button>
          </div>
        </div>

        {!doc?(
          <div className="rounded-2xl p-6" style={{background:AV.nm,border:`1px solid ${AV.nb}`}}>
            <div className="mb-4"><label className="block text-xs font-semibold mb-1.5 uppercase tracking-wider" style={{color:AV.tm}}>Customer Name</label><input type="text" placeholder="e.g. Acme Corp" value={custName} onChange={e=>{setCustName(e.target.value);ss("tf_doc_cust",e.target.value);}} className="w-full rounded-xl px-4 py-2.5 text-sm" style={{background:AV.nl,border:`1px solid ${AV.nb}`,color:AV.tp,outline:"none"}}/></div>
          <div onDragOver={e=>{e.preventDefault();setDrag(true);}} onDragLeave={()=>setDrag(false)} onDrop={onDrop} onClick={()=>ref.current.click()} className="rounded-xl p-10 text-center cursor-pointer transition-all" style={{border:`2px dashed ${drag?AV.or:AV.nb}`,background:drag?`${AV.or}08`:`${AV.nl}80`}}>
              <input ref={ref} type="file" multiple accept=".tf,.tfvars,.zip" className="hidden" onChange={e=>handleFiles(e.target.files)}/>
              <div className="flex flex-col items-center gap-3">
                <div className="w-16 h-16 rounded-2xl flex items-center justify-center" style={{background:drag?`${AV.or}20`:AV.nl,border:`1px solid ${drag?AV.or:AV.nb}`}}>
                  {extr?<svg className="animate-spin w-7 h-7" style={{color:AV.or}} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 12a9 9 0 1 1-6.22-8.56"/></svg>:<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-7 h-7" style={{color:drag?AV.or:AV.tm}}><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>}
                </div>
                <div><p className="font-semibold" style={{color:AV.tp}}>{extr?"Extracting…":"Drop Terraform files or ZIP"}</p><p className="text-sm mt-1" style={{color:AV.tm}}><code style={{color:AV.or}}>.tf</code> · <code style={{color:AV.or}}>.tfvars</code> · <code style={{color:"#FCD34D"}}>.zip</code></p></div>
              </div>
            </div>

            {files.length>0&&<div className="mt-5 space-y-3">
              <div className="flex items-center justify-between"><p className="text-sm font-semibold" style={{color:AV.tp}}>{files.length} file{files.length>1?"s":""} ready</p><button onClick={()=>setFiles([])} className="text-xs" style={{color:AV.tm}}>Clear all</button></div>
              {Object.entries(grouped).map(([folder,fls])=>(
                <div key={folder} className="rounded-xl overflow-hidden" style={{border:`1px solid ${AV.nb}`}}>
                  <div className="px-4 py-2 text-xs font-bold uppercase tracking-wider" style={{background:AV.nl,color:AV.tm}}>📁 {folder}</div>
                  {fls.map((f,i)=><div key={i} className="flex items-center gap-3 px-4 py-2 text-sm" style={{borderTop:`1px solid ${AV.nb}`}}><span style={{color:AV.or}}>📄</span><span className="font-mono" style={{color:AV.tp}}>{f.name}</span><span className="ml-auto text-xs" style={{color:AV.tm}}>{(f.content.length/1024).toFixed(1)} KB</span><button onClick={()=>setFiles(fs=>fs.filter(x=>x.path!==f.path))} style={{color:AV.tm}}>✕</button></div>)}
                </div>
              ))}
            </div>}

            {error&&<div className="mt-4 rounded-xl px-4 py-3 text-sm" style={{background:"#EC489910",border:"1px solid #EC489940",color:"#F9A8D4"}}><div className="font-semibold mb-1">⚠ Error</div><pre className="text-xs whitespace-pre-wrap break-all">{error}</pre></div>}
            {debug&&debug.step!=="done"&&<div className="mt-3 rounded-xl px-4 py-3 text-xs" style={{background:"#0A0E1A",border:`1px solid ${AV.nb}`,color:AV.tm}}><div className="font-bold mb-2" style={{color:AV.or}}>Debug</div><div>Step: <span style={{color:AV.tp}}>{debug.step}</span> · HTTP: <span style={{color:debug.apiStatus===200?"#22C55E":"#EC4899"}}>{debug.apiStatus??"—"}</span> · Stop: {debug.stopReason||"—"}</div>{debug.statusMsg&&<div className="mt-1" style={{color:"#FCA5A5"}}>{debug.statusMsg}</div>}{debug.apiBody&&<details className="mt-2"><summary style={{color:AV.or,cursor:"pointer"}}>API response</summary><pre className="mt-1 whitespace-pre-wrap break-all" style={{color:"#94A3B8"}}>{debug.apiBody}</pre></details>}</div>}

            {loading&&<div className="mt-6 rounded-xl p-4" style={{background:AV.nm,border:`1px solid ${AV.nb}`}}>
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium" style={{color:AV.tp}}>{progress.label}</span>
                <span className="text-xs font-mono" style={{color:AV.or}}>{progress.step}%</span>
              </div>
              <div className="w-full h-2 rounded-full overflow-hidden" style={{background:AV.nl}}>
                <div className="h-full rounded-full" style={{width:`${progress.step}%`,background:`linear-gradient(90deg,${AV.or},${AV.pu})`,transition:"width 0.6s ease"}}/>
              </div>
            </div>}

            <button onClick={analyze} disabled={!files.length||loading||extr} className="mt-6 w-full py-4 rounded-xl font-bold text-white transition-all active:scale-[0.98] disabled:opacity-40 disabled:cursor-not-allowed" style={{background:`linear-gradient(135deg,${AV.or},${AV.pu})`,boxShadow:`0 4px 24px ${AV.or}30`}}>
              {loading?<span className="flex items-center justify-center gap-3"><svg className="animate-spin w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 12a9 9 0 1 1-6.22-8.56"/></svg>Generating…</span>:"Generate Design Document ✦"}
            </button>
          </div>
        ):(
          <div>
            <button onClick={()=>{setDoc(null);setDebug(null);setError(null);}} className="mb-4 flex items-center gap-2 text-sm" style={{color:AV.tm}}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-4 h-4"><path d="M19 12H5M12 19l-7-7 7-7"/></svg>Start over
            </button>
            <DocView doc={doc} selModel={selModel} dark={dark} onExport={()=>exportDocx(doc,custName)}/>
          </div>
        )}
      </div>
    </div>
  );
}
