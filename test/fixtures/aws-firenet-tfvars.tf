module "mc-transit" {
  source  = "terraform-aviatrix-modules/mc-transit/aviatrix"
  version = "2.5.0"
  cloud   = "AWS"
  region  = "us-west-2"
  cidr    = "10.2.0.0/23"
  account = "aws-prod"
  gw_name = "aws-transit-west"
}

module "mc-firenet" {
  source         = "terraform-aviatrix-modules/mc-firenet/aviatrix"
  version        = "1.5.0"
  transit_module = module.mc-transit
  firewall_image = var.firewall_image
  fw_amount      = var.fw_amount
  instance_size  = var.fw_instance_size
}
