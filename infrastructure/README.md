# EasyFlow Infrastructure as Code

This directory contains Terraform configuration for managing EasyFlow infrastructure.

## Quick Start

### 1. Install Terraform

```bash
# macOS
brew install terraform

# Verify installation
terraform --version
```

### 2. Initialize Terraform

```bash
cd infrastructure
npm run infra:init
# or
../scripts/terraform-init.sh dev
```

### 3. Plan Changes

```bash
npm run infra:plan
# or
../scripts/terraform-plan.sh dev
```

### 4. Apply Changes

```bash
npm run infra:apply
# or
../scripts/terraform-apply.sh dev
```

## Available Commands

All commands can be run from the EasyFlow root directory:

- `npm run infra:init` - Initialize Terraform
- `npm run infra:plan` - Plan infrastructure changes
- `npm run infra:apply` - Apply infrastructure changes
- `npm run infra:validate` - Validate Terraform configuration
- `npm run infra:destroy` - Destroy infrastructure (with confirmation)
- `npm run infra:fmt` - Format Terraform files
- `npm run infra:fmt:check` - Check formatting (for CI/CD)
- `npm run infra:drift` - Detect infrastructure drift

## Current Setup

This infrastructure setup currently uses the `local` provider for testing. This allows you to:

- Learn Terraform without cloud credentials
- Test the workflow locally
- Practice infrastructure as code concepts

## Next Steps

1. **Add Cloud Provider**: Uncomment and configure AWS/Azure/GCP provider in `main.tf`
2. **Add Resources**: Add VPC, compute, storage, database resources
3. **Configure Remote State**: Set up S3/Azure Storage/GCS for state storage
4. **Add Environments**: Create separate configurations for dev/staging/prod

## Best Practices

- ✅ Always run `plan` before `apply`
- ✅ Use remote state for team collaboration
- ✅ Version control all `.tf` files
- ✅ Never commit `.tfstate` files (already in .gitignore)
- ✅ Review plans in pull requests
- ✅ Use modules for reusable patterns

## Documentation

See the main Infrastructure as Code toolkit documentation:
- `/Users/ky/infrastructure-as-code/README.md`

