#!/usr/bin/env bash
# Concatenate the three parts into one combined reel.
# Usage: scripts/concat.sh ko|en
set -euo pipefail
LANG_CODE="${1:-ko}"
cd "$(dirname "$0")/.."

if [ "$LANG_CODE" = "ko" ]; then
  A="out/A_문제를통제한다_ko.mp4"
  B="out/B_AI가만들고사람이승인한다_ko.mp4"
  C="out/C_운영이되고계속좋아진다_ko.mp4"
  OUT="out/전체_INS정산AI데모_ko.mp4"
else
  A="out/A_take-control_en.mp4"
  B="out/B_ai-drafts-people-approve_en.mp4"
  C="out/C_runs-and-improves_en.mp4"
  OUT="out/full_INS-settlement-AI_en.mp4"
fi

LIST="$(mktemp)"
for f in "$A" "$B" "$C"; do
  [ -f "$f" ] || { echo "missing: $f"; exit 1; }
  echo "file '$PWD/$f'" >> "$LIST"
done

# Re-encode on concat so the three parts join cleanly (identical codec params anyway).
ffmpeg -y -f concat -safe 0 -i "$LIST" -c:v libx264 -crf 18 -pix_fmt yuv420p "$OUT"
rm -f "$LIST"
echo "→ $OUT"
