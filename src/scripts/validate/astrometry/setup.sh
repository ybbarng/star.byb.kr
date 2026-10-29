#!/bin/sh
# 분석용 정답지(astrometry.net, 로컬)를 준비한다. 앱 풀이에는 쓰지 않는다 (원칙 1: 디버깅·비교용).
#   sh src/scripts/validate/astrometry/setup.sh
# brew로 solve-field를 깔고, 넓은 시야(약 10~75°)용 인덱스 4110~4119(합쳐 약 46MB)를 build/astrometry-index/에 받는다.
set -e
command -v solve-field >/dev/null || brew install astrometry-net
mkdir -p build/astrometry-index
for n in 4110 4111 4112 4113 4114 4115 4116 4117 4118 4119; do
  [ -f build/astrometry-index/index-$n.fits ] || curl -sf -o build/astrometry-index/index-$n.fits http://data.astrometry.net/4100/index-$n.fits
done
cat > build/astrometry-index/astrometry.cfg <<CFG
inparallel
cpulimit 180
add_path $PWD/build/astrometry-index
autoindex
CFG
