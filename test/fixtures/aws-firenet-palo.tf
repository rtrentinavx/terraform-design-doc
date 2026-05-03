module "mc-transit" {
  source  = "terraform-aviatrix-modules/mc-transit/aviatrix"
  version = "2.5.0"
  cloud   = "AWS"
  region  = "us-east-1"
  cidr    = "10.1.0.0/23"
  account = "aws-prod"
  gw_name = "aws-transit-prod"
}

module "mc-firenet" {
  source          = "terraform-aviatrix-modules/mc-firenet/aviatrix"
  version         = "1.5.0"
  transit_module  = module.mc-transit
  firewall_image  = "Palo Alto Networks VM-Series Next-Generation Firewall Bundle 1"
  fw_amount       = 2
  instance_size   = "c5.xlarge"
}

module "mc-spoke-app" {
  source          = "terraform-aviatrix-modules/mc-spoke/aviatrix"
  version         = "1.6.0"
  cloud           = "AWS"
  region          = "us-east-1"
  cidr            = "10.10.0.0/24"
  account         = "aws-prod"
  gw_name         = "aws-spoke-app"
  transit_gateway = module.mc-transit.transit_gateway
}
