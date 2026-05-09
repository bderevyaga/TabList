#!/bin/sh

set -eu

ROOT_DIR=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
ICONS_DIR="$ROOT_DIR/icons"
DEFAULT_LOGO="$ICONS_DIR/icon.svg"

usage() {
  cat <<'USAGE'
Usage:
  sh generate-icons.sh
  sh generate-icons.sh /absolute/path/to/logo.svg
  sh generate-icons.sh relative/path/to/logo.svg

Description:
  Generates icons/icon16.png, icons/icon32.png, icons/icon48.png, and
  icons/icon128.png from an SVG logo using macOS sips.
USAGE
}

require_command() {
  if ! command -v "$1" >/dev/null 2>&1; then
    printf 'Required command is not available: %s\n' "$1" >&2
    exit 1
  fi
}

resolve_logo_path() {
  candidate=$1

  case "$candidate" in
    /*) printf '%s\n' "$candidate" ;;
    *) printf '%s\n' "$ROOT_DIR/$candidate" ;;
  esac
}

if [ "${1:-}" = "--help" ]; then
  usage
  exit 0
fi

require_command sips

logo_path=$(resolve_logo_path "${1:-$DEFAULT_LOGO}")

if [ ! -f "$logo_path" ]; then
  printf 'SVG file not found: %s\n' "$logo_path" >&2
  exit 1
fi

mkdir -p "$ICONS_DIR"

for size in 16 32 48 128; do
  output_path="$ICONS_DIR/icon${size}.png"
  sips -s format png -z "$size" "$size" "$logo_path" --out "$output_path" >/dev/null
  printf 'Generated: %s\n' "$output_path"
done
