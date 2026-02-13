#!/usr/bin/env bash
# Convert all SVG slides to PNGs at 1200x1200 using ImageMagick
# Requires: imagemagick (magick or convert) or rsvg-convert

set -euo pipefail
OUT_DIR=assets/carousel/pngs
mkdir -p "$OUT_DIR"

for f in assets/carousel/*.svg; do
  name=$(basename "$f" .svg)
  if command -v magick >/dev/null 2>&1; then
    magick -background none -resize 1200x1200 -gravity center "$f" "$OUT_DIR/$name.png"
  elif command -v convert >/dev/null 2>&1; then
    convert -background none -resize 1200x1200 -gravity center "$f" "$OUT_DIR/$name.png"
  elif command -v rsvg-convert >/dev/null 2>&1; then
    rsvg-convert -w 1200 -h 1200 "$f" -o "$OUT_DIR/$name.png"
  else
    echo "Install ImageMagick or librsvg to convert SVGs to PNGs" >&2
    exit 1
  fi
  echo "Wrote $OUT_DIR/$name.png"
done
