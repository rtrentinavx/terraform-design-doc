// IDD Tool schema for Claude tool use (Phase 1)
// Kept in .ts (not .tsx) to avoid esbuild JSX parser conflicts with helper functions.

const str = (description: string, extra?: object) => ({ type: "string" as const, description, ...extra });
const strArr = (description: string) => ({ type: "array" as const, description, items: { type: "string" as const } });
const bool = (description: string) => ({ type: "boolean" as const, description });
const num = (description: string) => ({ type: "number" as const, description });
const obj = (properties: object, required: string[]) => ({
  type: "object" as const,
  additionalProperties: false as const,
  properties,
  required,
});
const arr = (items: object, description?: string) => ({
  type: "array" as const,
  ...(description ? { description } : {}),
  items,
});

export const IDD_TOOL = {
  name: "generate_idd",
  description: "Generate a complete Infrastructure Design Document from analyzed Terraform files. Call this tool exactly once with all fields populated.",
  input_schema: obj({
    title: str("Full document title including customer name"),
    version: str("Document version, default 1.0"),
    date: str("Today's date in YYYY-MM-DD format"),
    provider: str("Primary cloud provider", { enum: ["aws","azure","gcp","multi","unknown"] }),
    firewall_vendor: str("Detected firewall vendor", { enum: ["palo_alto","fortinet","checkpoint","cisco","none","unknown"] }),
    executive_summary: str("3-5 sentence architecture summary covering purpose, cloud provider, HA strategy, and security posture"),
    architecture_overview: obj({
      description: str("2-4 sentence topology explanation"),
      pattern: str("Architecture pattern", { enum: ["hub-and-spoke","flat","mesh","hybrid","unknown"] }),
      regions: strArr("Cloud regions used"),
      availability_zones: strArr("Availability zones used"),
      diagram_description: str("Plain-English description of the network diagram"),
    }, ["description","pattern","regions","availability_zones","diagram_description"]),
    network_design: obj({
      description: str("2-4 sentence IP addressing and routing strategy"),
      vpcs: arr(obj({
        name: str("VPC/VNet name exactly as in Terraform"),
        cidr: str("CIDR block"),
        purpose: str("1-2 sentence description of what this VPC hosts"),
        type: str("VPC role", { enum: ["transit","spoke","mgmt","shared","unknown"] }),
        gw_size: str("Aviatrix gateway VM instance type e.g. t3.medium. Append (HA) if HA enabled"),
        connected_transit: str("Exact name of the transit VPC this VPC attaches to. Empty for transit VPCs"),
        firenet: bool("true ONLY if this specific transit has FireNet enabled"),
      }, ["name","cidr","purpose","type","gw_size","connected_transit","firenet"]), "VPCs and VNets"),
      subnets: arr(obj({
        name: str("Subnet name"), cidr: str("Subnet CIDR"), purpose: str("Subnet purpose"),
        az: str("Availability zone"), vpc: str("Parent VPC name — must match a vpc.name exactly"),
      }, ["name","cidr","purpose","az","vpc"]), "Subnets"),
      routing: str("2-3 sentence routing model description"),
      network_domains: str("Aviatrix network domains. Empty string if enable_segmentation not enabled"),
      connectivity: str("2-3 sentence on-prem/edge/cloud connectivity description"),
    }, ["description","vpcs","subnets","routing","network_domains","connectivity"]),
    compute: obj({
      description: str("2-3 sentence compute summary"),
      instances: arr(obj({
        name: str("Instance name"), type: str("Instance type"),
        purpose: str("Instance purpose"), ha: bool("HA enabled"),
      }, ["name","type","purpose","ha"])),
    }, ["description","instances"]),
    security: obj({
      description: str("2-4 sentence security architecture summary"),
      firewall: str("1-2 sentence firewall description"),
      encryption: str("1-2 sentence encryption description"),
      access_control: str("1-2 sentence access control description"),
      inspection: str("1-2 sentence traffic inspection description"),
    }, ["description","firewall","encryption","access_control","inspection"]),
    firewall_detail: obj({
      present: bool("true if any firewall detected"),
      vendor: str("Firewall vendor name"), product: str("Firewall product name"),
      instance_size: str("VM instance type e.g. c5.xlarge"),
      vcpus: str("vCPU count as string"), memory_gb: str("Memory GB as string"),
      license_model: str("License model", { enum: ["BYOL","PAYG","included","unknown"] }),
      license_type: str("License type e.g. Bundle 1, BYOL, NGTP"),
      ha_mode: str("HA mode", { enum: ["active-active","active-passive","standalone","unknown"] }),
      ha_instances: num("Number of HA instances"),
      deployment_mode: str("Deployment mode e.g. Transit FireNet"),
      interfaces: strArr("Interface names e.g. management, egress, lan"),
      version: str("Firewall software version"),
      notes: str("2-3 sentences explaining firewall deployment, inspection, and HA"),
    }, ["present","vendor","product","instance_size","vcpus","memory_gb","license_model","license_type","ha_mode","ha_instances","deployment_mode","interfaces","version","notes"]),
    firewall_context: str("1-2 sentence firewall deployment context"),
    components: arr(obj({
      name: str("Component name"), type: str("Component type"),
      category: str("Category", { enum: ["compute","network","storage","database","security","monitoring","other"] }),
      purpose: str("1-2 sentence purpose"), configuration: str("Key configuration details"),
      dependencies: strArr("Dependency names"),
    }, ["name","type","category","purpose","configuration","dependencies"])),
    data_flows: arr(obj({
      name: str("Flow name"),
      description: str("1-2 sentence flow description — only paths traceable through actual resources"),
      path: strArr("Ordered hops — each must correspond to a real resource in the Terraform code"),
    }, ["name","description","path"])),
    modules_used: arr(obj({
      name: str("Module name"), source: str("Registry source"),
      version: str("Version"), purpose: str("Purpose"),
    }, ["name","source","version","purpose"])),
    variables_and_parameters: arr(obj({
      name: str("Variable name"), value_or_type: str("Value or type"),
      purpose: str("Purpose"), required: bool("Is required"),
    }, ["name","value_or_type","purpose","required"])),
    outputs: arr(obj({
      name: str("Output name"), description: str("Description"), consumed_by: str("Consumer"),
    }, ["name","description","consumed_by"])),
    deployment_notes: str("2-3 sentences on deployment order, dependencies, prerequisites"),
    provider_context: str("1-2 sentences on provider-specific context"),
    edge_devices: arr(obj({
      name: str("Device name"),
      type: str("Device type", { enum: ["selfmanaged","equinix","zscaler","platform","megaport","csp","spoke"] }),
      location: str("Site location"), size: str("Gateway size"), ha: bool("HA enabled"),
      wan: str("WAN interface"), lan: str("LAN interface"),
      connected_transit: str("Comma-separated connected transit names"), bgp_asn: str("BGP ASN"),
    }, ["name","type","location","size","ha","wan","lan","connected_transit","bgp_asn"])),
    external_connections: arr(obj({
      name: str("Connection name"),
      type: str("Connection type — must match actual connection_type in Terraform resource"),
      local_gw: str("Local gateway name"), remote_ip: str("Remote IP"),
      bgp_asn: str("BGP ASN"), tunnel_protocol: str("Tunnel protocol e.g. IPsec, GRE, LAN"),
    }, ["name","type","local_gw","remote_ip","bgp_asn","tunnel_protocol"])),
    dcf: obj({
      enabled: bool("DCF enabled"),
      default_action: str("Default action", { enum: ["deny","allow","unknown"] }),
      smart_groups: arr(obj({
        name: str("Group name"), description: str("Description"),
        filter_type: str("Filter type"), members: strArr("Members"),
      }, ["name","description","filter_type","members"])),
      web_groups: arr(obj({
        name: str("Group name"), domains: strArr("Domains"),
      }, ["name","domains"])),
      rulesets: arr(obj({
        name: str("Ruleset name"),
        type: str("Ruleset type", { enum: ["user","egress","system","unknown"] }),
        rules: arr(obj({
          name: str("Rule name"), priority: num("Priority"),
          src: str("Source"), dst: str("Destination"),
          protocol: str("Protocol"), port: str("Port"),
          action: str("Action", { enum: ["allow","deny","force-drop"] }),
          logging: bool("Logging enabled"), tls_decryption: bool("TLS decryption"),
          ips_profile: str("IPS profile name"),
        }, ["name","priority","src","dst","protocol","port","action","logging","tls_decryption","ips_profile"])),
      }, ["name","type","rules"])),
      ips_profiles: arr(obj({
        name: str("Profile name"), feeds: strArr("Feed names"),
        actions: obj({
          informational: str("Action"), minor: str("Action"),
          major: str("Action"), critical: str("Action"),
        }, ["informational","minor","major","critical"]),
        applied_to: strArr("Applied to"),
      }, ["name","feeds","actions","applied_to"])),
      egress_enabled: bool("Egress enabled"),
      tls_decryption_enabled: bool("TLS decryption enabled"),
      kubernetes_enabled: bool("Kubernetes enabled"),
      transit_egress: bool("Transit egress"),
      summary: str("2-3 sentence DCF summary"),
    }, ["enabled","default_action","smart_groups","web_groups","rulesets","ips_profiles","egress_enabled","tls_decryption_enabled","kubernetes_enabled","transit_egress","summary"]),
  }, ["title","version","date","provider","firewall_vendor","executive_summary","architecture_overview","network_design","compute","security","firewall_detail","firewall_context","components","data_flows","modules_used","variables_and_parameters","outputs","deployment_notes","provider_context","edge_devices","external_connections","dcf"]),
};
