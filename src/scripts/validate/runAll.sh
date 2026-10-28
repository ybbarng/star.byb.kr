#!/bin/sh
# 묶음 하나를 N조각으로 나란히 푼다 (검출 캐시가 없으면 먼저 만든다).
#   sh src/scripts/validate/runAll.sh web-2026-10 8000 base 4
set -e
SET=$1; BUDGET=$2; NAME=$3; N=${4:-4}
TSX="node_modules/.bin/tsx --tsconfig tsconfig.json"
i=0; while [ $i -lt $N ]; do $TSX src/scripts/validate/detect.ts $SET $i/$N & i=$((i+1)); done; wait
i=0; while [ $i -lt $N ]; do $TSX src/scripts/validate/run.ts $SET $BUDGET $NAME $i/$N & i=$((i+1)); done; wait
$TSX src/scripts/validate/report.ts $SET $NAME
