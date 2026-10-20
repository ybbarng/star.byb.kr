# 별자리선·별자리 경계 (d3-celestial)

출처: https://github.com/ofrohn/d3-celestial (`data/` 폴더, 2026-10-21에 받음). 이용 허락: BSD 3-Clause (`LICENSE`).

- `constellations.lines.json`: 별자리선. 국제천문연맹(IAU) 별자리 그림(Sky & Telescope의 Roger Sinnott·Rick Fienberg)을 바탕으로
  d3-celestial 작성자가 일부 고친 것. J2000 적경·적위(도, 적경은 -180~180).
- `constellations.bounds.json`: IAU 별자리 경계(88개 구역). Davenhall & Leggett (1989), VizieR VI/49를 J2000으로 바꾼 꼭짓점.
  경계의 변은 적경 또는 적위가 일정한 선이라, 꼭짓점 사이는 적경·적위 평면에서 곧게 잇는다.

`src/scripts/database/buildConstellations.ts`가 이 둘을 `build/database/`의 앱용 파일로 바꾼다.
