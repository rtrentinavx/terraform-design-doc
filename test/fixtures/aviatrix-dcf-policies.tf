# Aviatrix Distributed Cloud Firewall (DCF) — SmartGroups, WebGroups, and Policy List.
# Synthesized from the official Aviatrix Terraform provider documentation
# (resource: aviatrix_smart_group, aviatrix_web_group,
# aviatrix_distributed_firewalling_policy_list, aviatrix_distributed_firewalling_default_action_rule).

terraform {
  required_providers {
    aviatrix = {
      source  = "AviatrixSystems/aviatrix"
      version = "~> 3.2"
    }
  }
}

# Enable DCF on the controller.
resource "aviatrix_distributed_firewalling_config" "this" {
  enable_distributed_firewalling = true
}

# Default action — zero-trust DENY with logging.
resource "aviatrix_distributed_firewalling_default_action_rule" "default" {
  action  = "DENY"
  logging = true
}

# ── SmartGroups ───────────────────────────────────────────────────────────

# CIDR-based SmartGroup: a production VPC subnet range.
resource "aviatrix_smart_group" "prod_vpc" {
  name = "prod-vpc"
  selector {
    match_expressions {
      cidr = "10.20.0.0/16"
    }
  }
}

# CIDR-based SmartGroup: a non-prod VPC range.
resource "aviatrix_smart_group" "nonprod_vpc" {
  name = "nonprod-vpc"
  selector {
    match_expressions {
      cidr = "10.30.0.0/16"
    }
  }
}

# Tag/account-based SmartGroup: production VMs in AWS.
resource "aviatrix_smart_group" "prod_vms" {
  name = "prod-vms"
  selector {
    match_expressions {
      type         = "vm"
      account_name = "aws-prod"
      region       = "us-east-1"
      tags = {
        Environment = "production"
        Tier        = "web"
      }
    }
  }
}

# External feed SmartGroup: geo block of malicious source countries.
resource "aviatrix_smart_group" "geo_block" {
  name = "geo-block"
  selector {
    match_expressions {
      external = "geo"
      ext_args = {
        country_iso_code = "RU"
        continent_code   = "AS"
      }
    }
  }
}

# Threat-intel external SmartGroup.
resource "aviatrix_smart_group" "threatiq" {
  name = "threat-iq-major"
  selector {
    match_expressions {
      external = "threatiq"
      ext_args = {
        type     = "ciarmy"
        severity = "major"
        protocol = "tcp"
      }
    }
  }
}

# ── WebGroups ─────────────────────────────────────────────────────────────

# SNI-based WebGroup: allowed SaaS endpoints.
resource "aviatrix_web_group" "allowed_saas" {
  name = "allowed-saas"
  selector {
    match_expressions {
      snifilter = "*.salesforce.com"
    }
    match_expressions {
      snifilter = "*.office365.com"
    }
    match_expressions {
      snifilter = "github.com"
    }
  }
}

# URL-based WebGroup: explicit allow-list URLs for monitoring egress.
resource "aviatrix_web_group" "monitoring_urls" {
  name = "monitoring-urls"
  selector {
    match_expressions {
      urlfilter = "https://api.datadoghq.com/v1/metrics"
    }
    match_expressions {
      urlfilter = "https://*.sentry.io/api"
    }
  }
}

# ── Policy List ───────────────────────────────────────────────────────────

resource "aviatrix_distributed_firewalling_policy_list" "main" {

  # Permit east-west between prod and non-prod VPCs over HTTPS.
  policies {
    name             = "allow-prod-to-nonprod-https"
    action           = "PERMIT"
    priority         = 10
    protocol         = "TCP"
    logging          = true
    watch            = false
    src_smart_groups = [aviatrix_smart_group.prod_vpc.uuid]
    dst_smart_groups = [aviatrix_smart_group.nonprod_vpc.uuid]

    port_ranges {
      lo = 443
      hi = 443
    }
  }

  # Permit prod VMs to allowed SaaS WebGroup (SNI inspection).
  policies {
    name                 = "allow-prod-to-saas"
    action               = "PERMIT"
    priority             = 20
    protocol             = "TCP"
    logging              = true
    src_smart_groups     = [aviatrix_smart_group.prod_vms.uuid]
    dst_smart_groups     = [aviatrix_smart_group.prod_vpc.uuid]
    web_groups           = [aviatrix_web_group.allowed_saas.uuid]
    flow_app_requirement = "TLS_REQUIRED"
    decrypt_policy       = "DECRYPT_ALLOWED"

    port_ranges {
      lo = 443
      hi = 443
    }
  }

  # Permit prod to monitoring URLs.
  policies {
    name             = "allow-prod-to-monitoring"
    action           = "PERMIT"
    priority         = 30
    protocol         = "TCP"
    logging          = true
    src_smart_groups = [aviatrix_smart_group.prod_vms.uuid]
    dst_smart_groups = [aviatrix_smart_group.prod_vpc.uuid]
    web_groups       = [aviatrix_web_group.monitoring_urls.uuid]

    port_ranges {
      lo = 443
      hi = 443
    }
  }

  # Deny anything from the geo-block SmartGroup.
  policies {
    name             = "deny-geo-block"
    action           = "DENY"
    priority         = 40
    protocol         = "ANY"
    logging          = true
    src_smart_groups = [aviatrix_smart_group.geo_block.uuid]
    dst_smart_groups = [aviatrix_smart_group.prod_vpc.uuid]
  }

  # Deny ThreatIQ sources.
  policies {
    name             = "deny-threat-iq"
    action           = "DENY"
    priority         = 50
    protocol         = "ANY"
    logging          = true
    src_smart_groups = [aviatrix_smart_group.threatiq.uuid]
    dst_smart_groups = [aviatrix_smart_group.prod_vpc.uuid]
  }
}
