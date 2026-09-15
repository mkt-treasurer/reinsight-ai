#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
npx remotion render src/index.ts VideoA-en "out/A_take-control_en.mp4"
npx remotion render src/index.ts VideoB-en "out/B_ai-drafts-people-approve_en.mp4"
npx remotion render src/index.ts VideoC-en "out/C_runs-and-improves_en.mp4"
bash scripts/concat.sh en
echo "EN PIPELINE COMPLETE"
