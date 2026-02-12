#!/bin/bash
#
# @file Vault Setup Script
# @description Populates AWS Secrets Manager with secrets from GitHub Actions Secrets
# @author Medical Bible Team
# @version 1.0.0
#
# Usage:
#   ./setup-vault.sh [environment]
#
# Arguments:
#   environment  - Environment name (development, staging, production)
#
# Environment Variables Required:
#   AWS_REGION              - AWS region for Secrets Manager
#   AWS_ACCESS_KEY_ID        - AWS access key (optional, can use IAM role)
#   AWS_SECRET_ACCESS_KEY     - AWS secret key (optional, can use IAM role)
#   VAULT_SECRET_PREFIX      - Prefix for secret names (default: medical-bible)
#
# Source Secrets (from GitHub Actions Secrets):
#   DB_ROOT_PASSWORD         - Database root password
#   REDIS_PASSWORD          - Redis password
#   JWT_SECRET              - JWT signing secret
#   JWT_REFRESH_SECRET      - JWT refresh token secret (optional)
#   ENCRYPTION_KEY          - Application encryption key
#   ALIYUN_ACCESS_KEY_ID    - Aliyun access key (optional)
#   ALIYUN_ACCESS_KEY_SECRET - Aliyun secret key (optional)
#   WECHAT_APP_ID          - WeChat app ID (optional)
#   WECHAT_MCH_ID          - WeChat merchant ID (optional)
#   WECHAT_API_KEY         - WeChat API key (optional)
#   WECHAT_NOTIFY_URL      - WeChat notify URL (optional)
#   OSS_REGION             - Aliyun OSS region (optional)
#   OSS_ACCESS_KEY_ID       - Aliyun OSS key (optional)
#   OSS_ACCESS_KEY_SECRET    - Aliyun OSS secret (optional)
#   OSS_BUCKET             - Aliyun OSS bucket (optional)
#   OSS_ENDPOINT           - Aliyun OSS endpoint (optional)
#
# Output:
#   Creates secrets in AWS Secrets Manager with the following naming:
#   {VAULT_SECRET_PREFIX}/database-password
#   {VAULT_SECRET_PREFIX}/redis-password
#   {VAULT_SECRET_PREFIX}/jwt-secret
#   etc.
#

set -euo pipefail

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"

# Default values
VAULT_SECRET_PREFIX="${VAULT_SECRET_PREFIX:-medical-bible}"
AWS_REGION="${AWS_REGION:-us-east-1}"
ENVIRONMENT="${1:-development}"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Logging functions
log_info() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1" >&2
}

# Check if AWS CLI is installed
check_aws_cli() {
    if ! command -v aws &> /dev/null; then
        log_error "AWS CLI is not installed. Please install it first:"
        echo "  pip install awscli"
        echo "  or"
        echo "  brew install awscli"
        exit 1
    fi
    log_info "AWS CLI found: $(aws --version)"
}

# Configure AWS credentials
configure_aws_credentials() {
    if [[ -n "${AWS_ACCESS_KEY_ID:-}" ]] && [[ -n "${AWS_SECRET_ACCESS_KEY:-}" ]]; then
        log_info "Configuring AWS credentials..."
        export AWS_ACCESS_KEY_ID
        export AWS_SECRET_ACCESS_KEY
        export AWS_DEFAULT_REGION="${AWS_REGION}"
    else
        log_info "Using IAM role or default credential chain"
        export AWS_DEFAULT_REGION="${AWS_REGION}"
    fi
}

# Create or update a secret in AWS Secrets Manager
# Arguments:
#   $1 - Secret name (without prefix)
#   $2 - Secret value
#   $3 - Description
create_secret() {
    local secret_name="$1"
    local secret_value="$2"
    local description="$3"
    local full_name="${VAULT_SECRET_PREFIX}/${secret_name}"

    if [[ -z "${secret_value}" ]]; then
        log_warn "Skipping empty secret: ${secret_name}"
        return
    fi

    log_info "Creating/updating secret: ${full_name}"

    # Check if secret already exists
    if aws secretsmanager describe-secret --secret-id "${full_name}" --region "${AWS_REGION}" &> /dev/null; then
        # Secret exists, update it
        aws secretsmanager put-secret-value \
            --secret-id "${full_name}" \
            --secret-string "${secret_value}" \
            --region "${AWS_REGION}" \
            --description "${description} - ${ENVIRONMENT} environment" \
            2>&1 | grep -v "SecretBinary" | grep -v "SecretString" || true
    else
        # Create new secret
        aws secretsmanager create-secret \
            --name "${full_name}" \
            --description "${description} - ${ENVIRONMENT} environment" \
            --secret-string "${secret_value}" \
            --region "${AWS_REGION}" \
            --tags "Key=Environment,Value=${ENVIRONMENT}" "Key=Application,Value=medical-bible" \
            2>&1 | grep -v "SecretBinary" | grep -v "SecretString" || true
    fi
}

# Create secrets from environment variables
create_secrets() {
    log_info "Creating secrets for environment: ${ENVIRONMENT}"
    log_info "Secret prefix: ${VAULT_SECRET_PREFIX}"
    log_info "AWS region: ${AWS_REGION}"

    # Critical infrastructure secrets
    create_secret "database-password" "${DB_ROOT_PASSWORD:-}" "Database root password"
    create_secret "redis-password" "${REDIS_PASSWORD:-}" "Redis password"
    create_secret "jwt-secret" "${JWT_SECRET:-}" "JWT signing secret"
    create_secret "jwt-refresh-secret" "${JWT_REFRESH_SECRET:-}" "JWT refresh token secret"
    create_secret "encryption-key" "${ENCRYPTION_KEY:-}" "Application encryption key"

    # Optional service secrets
    create_secret "aliyun-access-key-id" "${ALIYUN_ACCESS_KEY_ID:-}" "Aliyun SMS access key ID"
    create_secret "aliyun-access-key-secret" "${ALIYUN_ACCESS_KEY_SECRET:-}" "Aliyun SMS access key secret"
    create_secret "aliyun-sms-sign-name" "${ALIYUN_SMS_SIGN_NAME:-}" "Aliyun SMS signature name"
    create_secret "aliyun-sms-template-code" "${ALIYUN_SMS_TEMPLATE_CODE:-}" "Aliyun SMS template code"

    create_secret "wechat-app-id" "${WECHAT_APP_ID:-}" "WeChat Pay app ID"
    create_secret "wechat-mch-id" "${WECHAT_MCH_ID:-}" "WeChat Pay merchant ID"
    create_secret "wechat-api-key" "${WECHAT_API_KEY:-}" "WeChat Pay API key"
    create_secret "wechat-notify-url" "${WECHAT_NOTIFY_URL:-}" "WeChat Pay notification URL"

    create_secret "oss-region" "${OSS_REGION:-}" "Aliyun OSS region"
    create_secret "oss-access-key-id" "${OSS_ACCESS_KEY_ID:-}" "Aliyun OSS access key ID"
    create_secret "oss-access-key-secret" "${OSS_ACCESS_KEY_SECRET:-}" "Aliyun OSS access key secret"
    create_secret "oss-bucket" "${OSS_BUCKET:-}" "Aliyun OSS bucket name"
    create_secret "oss-endpoint" "${OSS_ENDPOINT:-}" "Aliyun OSS endpoint"

    log_info "All secrets created/updated successfully"
}

# Verify secrets were created
verify_secrets() {
    log_info "Verifying secrets..."

    local secrets=(
        "database-password"
        "redis-password"
        "jwt-secret"
        "encryption-key"
    )

    local all_verified=true
    for secret_name in "${secrets[@]}"; do
        local full_name="${VAULT_SECRET_PREFIX}/${secret_name}"
        if aws secretsmanager describe-secret --secret-id "${full_name}" --region "${AWS_REGION}" &> /dev/null; then
            log_info "  ✓ ${full_name}"
        else
            log_error "  ✗ ${full_name} - NOT FOUND"
            all_verified=false
        fi
    done

    if [[ "${all_verified}" == "true" ]]; then
        log_info "All critical secrets verified!"
    else
        log_error "Some secrets are missing. Please check the logs above."
        exit 1
    fi
}

# Generate minimal .env file with vault configuration
generate_vault_env() {
    log_info "Generating .env file with vault configuration..."

    cat > .env << EOF
# Auto-generated by GitHub Actions - Vault Setup
# DO NOT EDIT MANUALLY

# Vault Configuration
VAULT_ENABLED=true
VAULT_REGION=${AWS_REGION}
VAULT_SECRET_PREFIX=${VAULT_SECRET_PREFIX}
VAULT_FALLBACK_TO_ENV=true

# Database (use vault, fallback to env if needed)
DB_HOST=localhost
DB_PORT=3306
DB_ROOT_USERNAME=root
DB_DATABASE=medical_bible

# Redis (use vault, fallback to env if needed)
REDIS_HOST=localhost
REDIS_PORT=6379

# Application
NODE_ENV=${ENVIRONMENT}
PORT=3000

# CORS
CORS_ORIGIN=${CORS_ORIGIN:-*}

# File URL
FILE_BASE_URL=${FILE_BASE_URL:-}

# Health Check
HEALTH_CHECK_ENABLED=true
HEALTH_CHECK_INTERVAL=30000
EOF

    log_info ".env file generated with vault configuration"
}

# Main execution
main() {
    log_info "=== AWS Secrets Manager Setup Script ==="
    log_info "Environment: ${ENVIRONMENT}"

    check_aws_cli
    configure_aws_credentials
    create_secrets
    verify_secrets
    generate_vault_env

    log_info "=== Vault Setup Complete ==="
    log_info "Next steps:"
    echo "  1. Review the secrets in AWS Secrets Manager console"
    echo "  2. Test the application with vault enabled"
    echo "  3. Monitor logs for any vault-related issues"
}

# Run main function
main "$@"
