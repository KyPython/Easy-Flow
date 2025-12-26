# Infrastructure as Code (Terraform)

**Part of DevOps Productivity Suite - Tool #6**

This guide covers using Terraform to manage EasyFlow infrastructure. Infrastructure as Code eliminates "ClickOps" and ensures reproducible, version-controlled infrastructure.

## Quick Start

### 1. Install Terraform

```bash
# macOS
brew install terraform

# Verify installation
terraform --version
```

### 2. Initialize Infrastructure

```bash
cd infrastructure
npm run infra:init
```

This will:
- Download required Terraform providers
- Initialize the workspace
- Set up state management

### 3. Plan Changes

```bash
npm run infra:plan
```

This shows what Terraform will create, update, or destroy **before** making any changes.

### 4. Apply Changes

```bash
npm run infra:apply
```

This applies the planned changes after confirmation.

## Available Commands

All commands run from the EasyFlow root directory:

| Command | Description |
|---------|-------------|
| `npm run infra:init` | Initialize Terraform workspace |
| `npm run infra:plan` | Plan infrastructure changes (dry run) |
| `npm run infra:apply` | Apply infrastructure changes |
| `npm run infra:validate` | Validate Terraform configuration |
| `npm run infra:destroy` | Destroy infrastructure (with confirmation) |
| `npm run infra:fmt` | Format Terraform files |
| `npm run infra:fmt:check` | Check formatting (for CI/CD) |
| `npm run infra:drift` | Detect infrastructure drift |

## Workflow

### Standard Workflow

1. **Make Changes** - Edit `.tf` files in `infrastructure/`
2. **Plan** - `npm run infra:plan` to see what will change
3. **Review** - Check the plan output carefully
4. **Apply** - `npm run infra:apply` to make changes
5. **Verify** - Confirm infrastructure matches expectations

### Before Making Changes

**Always run plan first:**
```bash
cd infrastructure
npm run infra:plan
```

This is a **dry run** - it shows what will happen without making changes.

### Making Changes

1. Edit Terraform files in `infrastructure/`
2. Run `npm run infra:plan` to preview
3. Review the plan output
4. Run `npm run infra:apply` to apply

### Destroying Infrastructure

**⚠️ Use with extreme caution:**
```bash
npm run infra:destroy
```

This requires multiple confirmations and will **delete** all infrastructure.

## Current Setup

The `infrastructure/` directory contains:

- `main.tf` - Main Terraform configuration
- `README.md` - Infrastructure-specific documentation

### Testing Without Cloud Credentials

The current setup uses the `local` provider, which allows you to:
- Learn Terraform without AWS/Azure/GCP credentials
- Test the workflow locally
- Practice infrastructure as code concepts

### Adding Cloud Resources

When ready to add actual cloud resources:

1. **Uncomment provider** in `main.tf`:
   ```hcl
   provider "aws" {
     region = var.aws_region
   }
   ```

2. **Add resources** to `main.tf` or create separate files:
   - `vpc.tf` - VPC and networking
   - `security.tf` - Security groups
   - `compute.tf` - EC2 instances
   - `storage.tf` - S3 buckets
   - `database.tf` - RDS databases

3. **Configure remote state** (uncomment backend block in `main.tf`)

## Best Practices

### ✅ Always Do This

- **Run `plan` before `apply`** - Review changes before applying
- **Version control all `.tf` files** - Commit infrastructure code
- **Use remote state** - Store state in S3/Azure Storage/GCS for team collaboration
- **Review plans in PRs** - Include `terraform plan` output in pull requests
- **Tag resources** - Add tags for cost tracking and organization

### ❌ Never Do This

- **Never commit `.tfstate` files** - Already in `.gitignore`
- **Never apply without reviewing plan** - Always review first
- **Never make manual console changes** - Use Terraform for all changes
- **Never skip validation** - Run `npm run infra:validate` regularly

## State Management

### Local State (Development)

For local development, state is stored in `terraform.tfstate` (gitignored).

### Remote State (Production)

Configure remote state backend in `main.tf`:

```hcl
terraform {
  backend "s3" {
    bucket         = "easyflow-terraform-state"
    key            = "dev/terraform.tfstate"
    region         = "us-east-1"
    encrypt        = true
    dynamodb_table = "terraform-locks"
  }
}
```

**Benefits:**
- Team collaboration (shared state)
- State locking (prevent conflicts)
- State encryption (security)
- State versioning (backup)

## Environment Management

Support for multiple environments (dev, staging, prod):

```bash
# Use environment-specific variables
export TF_VAR_environment=dev
npm run infra:plan

# Or specify in command (scripts support this)
cd infrastructure
../scripts/terraform-plan.sh staging
```

## Drift Detection

Detect when actual infrastructure differs from code:

```bash
npm run infra:drift
```

**What it does:**
- Refreshes state from cloud
- Compares with code
- Reports differences

**If drift detected:**
1. Review differences
2. Either update code to match infrastructure, or
3. Run `terraform apply` to update infrastructure to match code

## CI/CD Integration

### GitHub Actions Example

```yaml
name: Terraform Plan

on:
  pull_request:
    paths:
      - 'infrastructure/**'

jobs:
  terraform-plan:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: hashicorp/setup-terraform@v2
      
      - name: Terraform Init
        run: |
          cd infrastructure
          npm run infra:init
      
      - name: Terraform Validate
        run: |
          cd infrastructure
          npm run infra:validate
      
      - name: Terraform Plan
        run: |
          cd infrastructure
          npm run infra:plan
```

## Troubleshooting

### "State file locked"

Another process is using Terraform. Wait or check for stale locks.

### "Backend configuration changed"

Terraform detected backend changes. Run `terraform init -migrate-state`.

### "Provider not found"

Run `npm run infra:init` to download required providers.

### "Validation failed"

Check your Terraform syntax:
```bash
npm run infra:validate
```

## Security

- ✅ State files are gitignored (contains sensitive data)
- ✅ Use environment variables for secrets (never hardcode)
- ✅ Enable state encryption in remote backend
- ✅ Use IAM roles with least privilege
- ✅ Enable audit logging for state changes

## Related Documentation

- **Infrastructure Directory:** `infrastructure/README.md`
- **DevOps Suite:** `docs/DEVOPS_SUITE_REQUIREMENTS.md`
- **Main Toolkit:** `/Users/ky/infrastructure-as-code/README.md`

## Key Concepts

### Declarative vs Imperative

**Declarative (Terraform):** Define *what* you need
```hcl
resource "aws_s3_bucket" "data" {
  bucket = "my-bucket"
}
```

**Imperative (Scripts):** Define *how* to build it
```bash
aws s3 create-bucket --bucket my-bucket
```

### State File

The state file (`terraform.tfstate`) maps your code to real infrastructure:
- Code: `resource "aws_s3_bucket" "data"`
- Reality: `bucket-12345` (actual AWS bucket ID)

**Never lose the state file** - it's the source of truth.

### Drift

When actual infrastructure differs from code:
- Manual console changes
- External modifications
- Provider bugs

Use `npm run infra:drift` to detect and fix.

## Next Steps

1. **Add Cloud Provider** - Configure AWS/Azure/GCP provider
2. **Add Resources** - Create VPC, compute, storage, database resources
3. **Configure Remote State** - Set up S3/Azure Storage/GCS
4. **Add Environments** - Create dev/staging/prod configurations
5. **CI/CD Integration** - Add Terraform checks to GitHub Actions

---

**Remember:** Infrastructure as Code treats infrastructure exactly like application code - version controlled, peer-reviewed, and reproducible.

