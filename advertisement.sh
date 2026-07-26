#!/bin/sh

set -eu

ROOT_DIR=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)

usage() {
  cat <<'USAGE'
Usage:
  sh advertisement.sh
  sh advertisement.sh /absolute/path/to/advertisement.svg

Description:
  Generates PNG files from SVG images in the advertisement folder using macOS sips.
  If no file is provided, it processes all .svg files in the advertisement/ directory.
USAGE
}

process_svg() {
  svg_path=$(resolve_path "$1")

  if [ ! -f "$svg_path" ]; then
    printf 'SVG file not found: %s\n' "$svg_path" >&2
    return 1
  fi

  icon_path="$ROOT_DIR/icons/icon.svg"
  if [ ! -f "$icon_path" ]; then
    printf 'Icon file not found: %s\n' "$icon_path" >&2
    exit 1
  fi

  # Create a temporary SVG with embedded base64 icon for sips
  temp_svg=$(mktemp).svg
  icon_base64=$(base64 < "$icon_path" | tr -d '\n')
  sed "s|href=\"icons/icon.svg\"|href=\"data:image/svg+xml;base64,$icon_base64\"|g" "$svg_path" > "$temp_svg"

  output_path="${svg_path%.svg}.png"

  sips -s format png "$temp_svg" --out "$output_path" >/dev/null
  rm "$temp_svg"

  printf 'Generated: %s\n' "$output_path"
}

require_command() {
  if ! command -v "$1" >/dev/null 2>&1; then
    printf 'Required command is not available: %s\n' "$1" >&2
    exit 1
  fi
}

resolve_path() {
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
require_command base64

if [ -n "${1:-}" ]; then
  process_svg "$1"
else
  for f in "$ROOT_DIR"/advertisement/*.svg; do
    [ -e "$f" ] || continue
    process_svg "$f"
  done
fi
