#!/bin/sh
# 사진 한 장을 astrometry로 푼다: solve-one.sh <묶음> <파일>
SET="$1"; FILE="$2"; DIR="build/validate/astrometry/$SET"; BASE="${FILE%.*}"
mkdir -p "$DIR"
[ -f "$DIR/$BASE.wcs" ] && exit 0
solve-field --config build/astrometry-index/astrometry.cfg --scale-units degwidth --scale-low 15 --scale-high 120 \
  --downsample 2 --no-plots --overwrite --cpulimit 120 --dir "$DIR" "public/samples-external/$SET/$FILE" > "$DIR/$BASE.log" 2>&1
