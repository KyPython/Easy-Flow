#!/usr/bin/env bash
set -euo pipefail

# Usage:
#   export VERCEL_TOKEN="..."    # your Vercel token (rotate if leaked)
#   ./scripts/create-vercel-secrets.sh

TEAM_SLUG="kypythons-projects"
PROJECT_NAME="easy-flow"
SOURCE_FILE="ACTUAL_ENV_VALUES.txt"

if [ -z "${VERCEL_TOKEN:-}" ]; then
  echo "ERROR: set VERCEL_TOKEN environment variable"
  exit 1
fi

if ! command -v jq >/dev/null 2>&1; then
  echo "ERROR: jq is required. Install with: brew install jq"
  exit 1
fi

# get team id
TEAM_ID=$(curl -s -H "Authorization: Bearer $VERCEL_TOKEN" "https://api.vercel.com/v1/teams" \
  | jq -r --arg slug "$TEAM_SLUG" '.teams[] | select(.slug==$slug) | .id')
if [ -z "$TEAM_ID" ]; then
  echo "ERROR: team '$TEAM_SLUG' not found"
  exit 1
fi
echo "Team ID: $TEAM_ID"

# get projects (response is array directly)
PROJECTS_RESPONSE=$(curl -s -H "Authorization: Bearer $VERCEL_TOKEN" "https://api.vercel.com/v1/projects?teamId=$TEAM_ID")

# extract project id from array
PROJECT_ID=$(echo "$PROJECTS_RESPONSE" | jq -r --arg name "$PROJECT_NAME" '.[] | select(.name==$name) | .id' 2>/dev/null || true)

if [ -z "$PROJECT_ID" ]; then
  echo "ERROR: project '$PROJECT_NAME' not found in team '$TEAM_SLUG'"
  echo "Available projects:"
  echo "$PROJECTS_RESPONSE" | jq -r '.[].name' 2>/dev/null || echo "Failed to parse projects response"
  exit 1
fi
echo "Project ID: $PROJECT_ID"

# function to get value from source file
get_value() {
  local key="$1"
  if [ -f "$SOURCE_FILE" ]; then
    grep "^$key=" "$SOURCE_FILE" 2>/dev/null | head -1 | cut -d'=' -f2- | sed 's/#.*//' | tr -d '\r\n'
  fi
}

# get existing project env vars to avoid duplicates
echo "Getting existing project env vars..."
EXISTING_ENVS=$(curl -s -H "Authorization: Bearer $VERCEL_TOKEN" "https://api.vercel.com/v9/projects/$PROJECT_ID/env")

# env keys for environment variables (no separate secrets needed)
ENV_KEYS=(
  "REACT_APP_SUPABASE_URL"
  "REACT_APP_SUPABASE_ANON_KEY"
  "REACT_APP_API_URL"
  "REACT_APP_FIREBASE_API_KEY"
  "REACT_APP_FIREBASE_AUTH_DOMAIN"
  "REACT_APP_FIREBASE_DATABASE_URL"
  "REACT_APP_FIREBASE_PROJECT_ID"
  "REACT_APP_FIREBASE_STORAGE_BUCKET"
  "REACT_APP_FIREBASE_MESSAGING_SENDER_ID"
  "REACT_APP_FIREBASE_APP_ID"
  "REACT_APP_FIREBASE_MEASUREMENT_ID"
  "REACT_APP_FIREBASE_VAPID_KEY"
)

for ENV_KEY in "${ENV_KEYS[@]}"; do
  # try to get value from file first
  VALUE=$(get_value "$ENV_KEY")
  
  # prompt if not found
  if [ -z "$VALUE" ]; then
    echo -n "Enter value for $ENV_KEY (or press enter to skip): "
    read VALUE
  fi
  
  if [ -z "$VALUE" ]; then
    echo "Skipping $ENV_KEY (no value provided)"
    continue
  fi

  echo "Processing $ENV_KEY"

  # check if env var already exists in project
  ENV_EXISTS=$(echo "$EXISTING_ENVS" | jq -r --arg key "$ENV_KEY" '.envs[]? | select(.key==$key) | .id' 2>/dev/null || true)
  
  if [ -n "$ENV_EXISTS" ]; then
    echo "Environment variable $ENV_KEY already exists in project. Updating..."
    # Update existing env var with the literal value
    UPDATE_RESPONSE=$(curl -s -X PATCH "https://api.vercel.com/v9/projects/$PROJECT_ID/env/$ENV_EXISTS" \
      -H "Authorization: Bearer $VERCEL_TOKEN" \
      -H "Content-Type: application/json" \
      -d "{\"value\":\"$VALUE\",\"target\":[\"production\",\"preview\",\"development\"],\"type\":\"encrypted\"}")
    echo "Update env response: $UPDATE_RESPONSE"
  else
    echo "Creating project env variable: $ENV_KEY"
    ENV_RESPONSE=$(curl -s -X POST "https://api.vercel.com/v9/projects/$PROJECT_ID/env" \
      -H "Authorization: Bearer $VERCEL_TOKEN" \
      -H "Content-Type: application/json" \
      -d "{\"key\":\"$ENV_KEY\",\"value\":\"$VALUE\",\"target\":[\"production\",\"preview\",\"development\"],\"type\":\"encrypted\"}")
    echo "Env creation response: $ENV_RESPONSE"
  fi
  sleep 1
done

echo "Done. Environment variables have been set directly (no separate secrets needed)."
echo "Remove any @SECRET_NAME references from vercel.json and trigger a redeploy."