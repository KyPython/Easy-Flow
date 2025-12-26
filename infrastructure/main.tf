# EasyFlow Infrastructure as Code
# Terraform configuration for EasyFlow infrastructure

terraform {
  required_version = ">= 1.0"

  required_providers {
    # Add providers as needed (AWS, Azure, GCP, etc.)
    # Example for AWS:
    # aws = {
    #   source  = "hashicorp/aws"
    #   version = "~> 5.0"
    # }

    # Local provider for testing without cloud credentials
    local = {
      source  = "hashicorp/local"
      version = "~> 2.0"
    }
  }

  # Configure remote state backend (uncomment and configure when ready)
  # backend "s3" {
  #   bucket         = "easyflow-terraform-state"
  #   key            = "dev/terraform.tfstate"
  #   region         = "us-east-1"
  #   encrypt        = true
  #   dynamodb_table = "terraform-locks"
  # }
}

# Variables
variable "environment" {
  description = "Environment name (dev, staging, prod)"
  type        = string
  default     = "dev"
}

variable "project_name" {
  description = "Project name for resource naming"
  type        = string
  default     = "easyflow"
}

# Example: Create a local file (for testing without cloud credentials)
# Remove this when you add actual cloud resources
resource "local_file" "infrastructure_info" {
  content  = <<-EOT
    EasyFlow Infrastructure
    Environment: ${var.environment}
    Project: ${var.project_name}
    Managed by: Terraform
    Created: ${timestamp()}
  EOT
  filename = "${path.module}/infrastructure-info.txt"
}

# Outputs
output "environment" {
  description = "Environment name"
  value       = var.environment
}

output "project_name" {
  description = "Project name"
  value       = var.project_name
}

output "info_file" {
  description = "Path to infrastructure info file"
  value       = local_file.infrastructure_info.filename
}

