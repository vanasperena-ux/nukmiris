terraform {
  required_version = "= 1.17.2"
  required_providers {
    google = { source = "hashicorp/google", version = "= 8.11.0" }
  }
}
provider "google" {
  project      = "b1a2-fixture-run"
  region       = "us-central1"
  access_token = "PLAN_ONLY_NOT_A_CREDENTIAL"
}
