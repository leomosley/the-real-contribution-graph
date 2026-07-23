terraform {
  # Cloudflare R2 backend (S3-compatible).
  # CI passes credentials via AWS_ACCESS_KEY_ID & AWS_SECRET_ACCESS_KEY.
  # Endpoint set via AWS_ENDPOINT_URL_S3.
  backend "s3" {
    bucket = "the-real-contributions-graph"
    key    = "terraform.tfstate"
    region = "auto"

    skip_credentials_validation = true
    skip_requesting_account_id  = true
    skip_metadata_api_check     = true
    skip_region_validation      = true
    skip_s3_checksum            = true
  }

  required_providers {
    cloudflare = {
      source  = "cloudflare/cloudflare"
      version = "~> 4.0"
    }
  }

  required_version = ">= 1.9"
}

provider "cloudflare" {
  api_token = var.cloudflare_api_token
}
