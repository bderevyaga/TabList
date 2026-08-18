#!/bin/sh

set -eu

ROOT_DIR=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
MANIFEST_PATH="$ROOT_DIR/manifest.json"
RELEASES_DIR="$ROOT_DIR/releases"
EXTENSION_NAME="TabList"

usage() {
  cat <<'EOF'
Usage:
  sh release.sh patch
  sh release.sh minor
  sh release.sh major
  sh release.sh --set-version X.Y.Z

Description:
  Bumps the extension version in manifest.json and creates a release archive
  in the releases/ directory.
EOF
}

require_file() {
  if [ ! -f "$1" ]; then
    printf 'Required file not found: %s\n' "$1" >&2
    exit 1
  fi
}

require_command() {
  if ! command -v "$1" >/dev/null 2>&1; then
    printf 'Required command is not available: %s\n' "$1" >&2
    exit 1
  fi
}

read_current_version() {
  awk -F'"' '/"version"[[:space:]]*:/ { print $4; exit }' "$MANIFEST_PATH"
}

validate_version() {
  version_value=$1

  if ! printf '%s' "$version_value" | grep -Eq '^[0-9]+(\.[0-9]+){0,3}$'; then
    printf 'Invalid version: %s\n' "$version_value" >&2
    printf 'Chrome extension versions must contain 1 to 4 numeric parts.\n' >&2
    exit 1
  fi
}

compute_next_version() {
  current_version=$1
  bump_type=$2

  old_ifs=${IFS}
  IFS=.
  set -- $current_version
  IFS=${old_ifs}

  major=${1:-0}
  minor=${2:-0}
  patch=${3:-0}
  build=${4:-}

  case "$bump_type" in
    major)
      major=$((major + 1))
      minor=0
      patch=0
      build=
      ;;
    minor)
      minor=$((minor + 1))
      patch=0
      build=
      ;;
    patch)
      patch=$((patch + 1))
      build=
      ;;
    *)
      printf 'Unsupported bump type: %s\n' "$bump_type" >&2
      exit 1
      ;;
  esac

  printf '%s.%s.%s' "$major" "$minor" "$patch"
}

update_manifest_version() {
  next_version=$1
  temp_file=$(mktemp)

  awk -v next_version="$next_version" '
    BEGIN { updated = 0 }
    !updated && /"version"[[:space:]]*:/ {
      sub(/"version"[[:space:]]*:[[:space:]]*"[^"]+"/, "\"version\": \"" next_version "\"")
      updated = 1
    }
    { print }
    END {
      if (!updated) {
        exit 1
      }
    }
  ' "$MANIFEST_PATH" > "$temp_file" || {
    rm -f "$temp_file"
    printf 'Failed to update version in manifest.json\n' >&2
    exit 1
  }

  mv "$temp_file" "$MANIFEST_PATH"
}

create_archive() {
  version_value=$1
  archive_path="$RELEASES_DIR/${EXTENSION_NAME}-v${version_value}.zip"

  mkdir -p "$RELEASES_DIR"
  rm -f "$archive_path"

  (
    cd "$ROOT_DIR"
    zip -qr "$archive_path" background.js manifest.json popup.html popup.css popup icons
  )

  printf '%s\n' "$archive_path"
}

require_file "$MANIFEST_PATH"
require_command zip

if [ $# -eq 1 ] && [ "$1" = "--help" ]; then
  usage
  exit 0
fi

if [ $# -eq 2 ] && [ "$1" = "--set-version" ]; then
  next_version=$2
else
  if [ $# -ne 1 ]; then
    usage >&2
    exit 1
  fi

  current_version=$(read_current_version)

  if [ -z "$current_version" ]; then
    printf 'Could not read current version from manifest.json\n' >&2
    exit 1
  fi

  validate_version "$current_version"
  next_version=$(compute_next_version "$current_version" "$1")
fi

validate_version "$next_version"
update_manifest_version "$next_version"
archive_file=$(create_archive "$next_version")

printf 'Updated version: %s\n' "$next_version"
printf 'Archive created: %s\n' "$archive_file"
