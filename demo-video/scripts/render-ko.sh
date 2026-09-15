#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
npx remotion render src/index.ts VideoA-ko "out/A_문제를통제한다_ko.mp4"
npx remotion render src/index.ts VideoB-ko "out/B_AI가만들고사람이승인한다_ko.mp4"
npx remotion render src/index.ts VideoC-ko "out/C_운영이되고계속좋아진다_ko.mp4"
bash scripts/concat.sh ko
echo "KO PIPELINE COMPLETE"
