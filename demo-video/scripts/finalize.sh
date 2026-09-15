#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
# KR: A unaffected by the timing tweaks; re-render B & C, then re-concat.
npx remotion render src/index.ts VideoB-ko "out/B_AI가만들고사람이승인한다_ko.mp4"
npx remotion render src/index.ts VideoC-ko "out/C_운영이되고계속좋아진다_ko.mp4"
bash scripts/concat.sh ko
# EN full set + concat.
npx remotion render src/index.ts VideoA-en "out/A_take-control_en.mp4"
npx remotion render src/index.ts VideoB-en "out/B_ai-drafts-people-approve_en.mp4"
npx remotion render src/index.ts VideoC-en "out/C_runs-and-improves_en.mp4"
bash scripts/concat.sh en
echo "FINALIZE COMPLETE"
