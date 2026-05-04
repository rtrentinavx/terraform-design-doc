import { z } from "zod";

const VpcSchema = z.object({
  name: z.string(),
  cidr: z.string(),
  purpose: z.string(),
  type: z.enum(["transit","spoke","mgmt","shared","unknown"]),
  gw_size: z.string(),
  connected_transit: z.string(),
  firenet: z.boolean(),
});

const SubnetSchema = z.object({
  name: z.string(),
  cidr: z.string(),
  purpose: z.string(),
  az: z.string(),
  vpc: z.string(),
});

const InstanceSchema = z.object({
  name: z.string(),
  type: z.string(),
  purpose: z.string(),
  ha: z.boolean(),
});

const ComponentSchema = z.object({
  name: z.string(),
  type: z.string(),
  category: z.enum(["compute","network","storage","database","security","monitoring","other"]),
  purpose: z.string(),
  configuration: z.string(),
  dependencies: z.array(z.string()),
});

const DataFlowSchema = z.object({
  name: z.string(),
  description: z.string(),
  path: z.array(z.string()),
});

const EdgeDeviceSchema = z.object({
  name: z.string(),
  type: z.enum(["selfmanaged","equinix","zscaler","platform","megaport","csp","spoke"]),
  location: z.string(),
  size: z.string(),
  ha: z.boolean(),
  wan: z.string(),
  lan: z.string(),
  connected_transit: z.string(),
  bgp_asn: z.string(),
});

const ExternalConnectionSchema = z.object({
  name: z.string(),
  type: z.string(),
  local_gw: z.string(),
  remote_ip: z.string(),
  bgp_asn: z.string(),
  tunnel_protocol: z.string(),
});

const DCFRuleSchema = z.object({
  name: z.string(),
  priority: z.number(),
  src: z.string(),
  dst: z.string(),
  protocol: z.string(),
  port: z.string(),
  action: z.enum(["allow","deny","force-drop"]),
  logging: z.boolean(),
  tls_decryption: z.boolean(),
  ips_profile: z.string(),
});

const IPSProfileSchema = z.object({
  name: z.string(),
  feeds: z.array(z.string()),
  actions: z.object({
    informational: z.string(),
    minor: z.string(),
    major: z.string(),
    critical: z.string(),
  }),
  applied_to: z.array(z.string()),
});

export const HLDSchema = z.object({
  title: z.string(),
  version: z.string(),
  date: z.string(),
  provider: z.enum(["aws","azure","gcp","multi","unknown"]),
  firewall_vendor: z.enum(["palo_alto","fortinet","checkpoint","cisco","none","unknown"]),
  executive_summary: z.string(),
  architecture_overview: z.object({
    description: z.string(),
    pattern: z.enum(["hub-and-spoke","flat","mesh","hybrid","unknown"]),
    regions: z.array(z.string()),
    availability_zones: z.array(z.string()),
    diagram_description: z.string(),
  }),
  network_design: z.object({
    description: z.string(),
    vpcs: z.array(VpcSchema),
    subnets: z.array(SubnetSchema),
    routing: z.string(),
    network_domains: z.string(),
    connectivity: z.string(),
  }),
  compute: z.object({
    description: z.string(),
    instances: z.array(InstanceSchema),
  }),
  security: z.object({
    description: z.string(),
    firewall: z.string(),
    encryption: z.string(),
    access_control: z.string(),
    inspection: z.string(),
  }),
  firewall_detail: z.object({
    present: z.boolean(),
    vendor: z.string(),
    product: z.string(),
    instance_size: z.string(),
    vcpus: z.string(),
    memory_gb: z.string(),
    license_model: z.enum(["BYOL","PAYG","included","unknown"]),
    license_type: z.string(),
    ha_mode: z.enum(["active-active","active-passive","standalone","unknown"]),
    ha_instances: z.number(),
    deployment_mode: z.string(),
    interfaces: z.array(z.string()),
    version: z.string(),
    notes: z.string(),
  }),
  firewall_context: z.string(),
  components: z.array(ComponentSchema),
  data_flows: z.array(DataFlowSchema),
  modules_used: z.array(z.object({
    name: z.string(),
    source: z.string(),
    version: z.string(),
    purpose: z.string(),
  })),
  variables_and_parameters: z.array(z.object({
    name: z.string(),
    value_or_type: z.string(),
    purpose: z.string(),
    required: z.boolean(),
  })),
  outputs: z.array(z.object({
    name: z.string(),
    description: z.string(),
    consumed_by: z.string(),
  })),
  deployment_notes: z.string(),
  provider_context: z.string(),
  edge_devices: z.array(EdgeDeviceSchema),
  external_connections: z.array(ExternalConnectionSchema),
  dcf: z.object({
    enabled: z.boolean(),
    default_action: z.enum(["deny","allow","unknown"]),
    smart_groups: z.array(z.object({
      name: z.string(),
      description: z.string(),
      filter_type: z.string(),
      members: z.array(z.string()),
    })),
    web_groups: z.array(z.object({
      name: z.string(),
      domains: z.array(z.string()),
    })),
    rulesets: z.array(z.object({
      name: z.string(),
      type: z.enum(["user","egress","system","unknown"]),
      rules: z.array(DCFRuleSchema),
    })),
    ips_profiles: z.array(IPSProfileSchema),
    egress_enabled: z.boolean(),
    tls_decryption_enabled: z.boolean(),
    kubernetes_enabled: z.boolean(),
    transit_egress: z.boolean(),
    summary: z.string(),
  }),
  caveats: z.array(z.string()),
  mermaid_diagram: z.string().optional().default(""),
});

export type HLD = z.infer<typeof HLDSchema>;
