# 처음 보는 인터넷 사진 100장으로 검증 (2026-10)

밤새 Plate Solver를 처음 보는 인터넷 사진 100장에 돌리고, 맞았는지 따로 판정하고, 못 푼 원인을 나눴다.
**이 사진들로 알고리즘 값을 하나도 바꾸지 않았다** (src/ 코드는 그대로, 측정 스크립트는 세션 임시 폴더에만 두었다).

## 1. 요약

| | 8초 (앱과 같은 조건) | 60초 (진단용) |
|---|---|---|
| 확신 | **61 / 100** | 64 / 100 |
| 그중 겹친 별 기준으로 정답 | 60 | 62 |
| 그중 애매 (눈으로는 둘 다 맞음) | 1 (071) | 2 (071·075) |
| 틀린 답을 확신 | **0** | 0 |
| 모름 (후보만) | 39 | 36 |

- 확신한 61장은 모두 눈으로 봐도 별자리가 사진 별 위에 맞게 놓였다. 틀린 확신은 한 장도 없었다.
- 확신한 사진의 풀이 시간은 중앙값 0.09초, 61장 중 43장이 1초 안. 가장 오래 걸린 건 8.0초(027).
- 못 푼 39장 중 37장은 8초를 다 썼지만, 60초를 줘도 3장만 더 풀렸다. 나머지 36장은 60초 전에(13~45초) 모든 단계를 다 보고도 못 찾았다 → 대부분 "시간이 모자라서"가 아니라 "못 찾는 것"이다.
- 못 푼 원인 상위: 어안·초광각·파노라마 11장, 은하수 광각 원인 미확정 11장, 지상 불빛·구름·박명 5장, 광각 가장자리 4장, 8초 부족 3장, 밝은 별이 별다움에서 밀림 3장, 별 적음·좁은 시야 2장.

## 2. 사진과 조건

- **사진**: Wikimedia Commons에서 고른 밤하늘 사진 100장 (`public/samples-external/web-2026-10/web-001.jpg`~`web-100.jpg`, gitignore 대상이라 저장소에 없다).
  긴 변 약 1,920px 썸네일이라 EXIF는 12장에만 남았다. 출처표 `sources.csv`에 분류(class)·촬영 시각·일부 GPS가 있다.
- **고른 기준**: 일반인이 찍어 올릴 만한 다양한 사진. 오로라 12, 구름 9, 도시 불빛 9, 어안 5, 별자리 21, 별밭 5, 희미한 사진 5, 번개구름 1, 은하수 33장 (분류는 `sources.csv`의 첫 단어).
- **풀이**: 앱과 똑같은 흐름. `detectLikeApp`(src/test/real/detectImage.ts) → `buildSolverContext` → `solvePhoto` 기본값(시간 상한 8초). 외부 사진 테스트(`externalSamples.test.ts`)와 같은 방식이다.
- **기계**: Apple M3 Pro, node v20.11.0, 사진을 한 장씩 차례로 (8초 측정은 다른 작업 없이 혼자 돌렸다).
  - 사고 하나: 재시도 중 노트북이 잠들어 두 장(058·074)이 900초대로 찍혔다(`pmset` 로그로 확인). `caffeinate`로 잠들기를 막고 두 장을 다시 쟀다 (둘 다 8.9초, 결과 같음).
- 확신 못 한 39장은 8초로 한 번 더 쟀다 (기계 부하 탓 배제). 39장 모두 같은 결과였다.
- 진단용 60초 측정은 4개 프로세스를 나란히 돌렸다 (시간은 혼자 돌릴 때보다 조금 부풀었을 수 있다).

## 3. 정답 판정 기준 — 정답을 아는 샘플로 먼저 보정

정답 자세가 없으니, 풀이가 낸 변환으로 카탈로그 별(5등급 이하 1,625개)을 사진에 투영하고 **검출 별과 겹치는 수**로 판정한다.

- 검출은 앱 우선순위(별다움 → 밝기, 줄지음은 뒤로) 상위 100개. 풀이에 쓰지 않은 별(61~100위)까지 들어간다.
- 허용 반경 r = 사진 대각선 × 0.6% (풀이 검증과 같은 크기).
- m = 투영 별과 r 안에서 겹친 검출 수, 우연 기대 e = 검출 수 × (화면 안 투영 별 수 × πr² / 사진 넓이).
- m/e 비율 대신 **포아송 꼬리 확률 P(X ≥ m | e)의 -log10**(아래 "꼬리")을 쓴다. 비율은 e가 작을 때 폭주한다(journey 32장) — 아래 보정에서도 비율로는 두 무리가 겹쳤다.

### 3.1 보정: 샘플 14장 (정답 자세 `solvedPoses.json`)

| 자세 | 개수 | 겹친 별 m | 꼬리 (-log10) | m/e |
|---|---|---|---|---|
| **정답** | 14 | 27 ~ 84 | **18.2 ~ 67.1** | 10.6 ~ 28 |
| 정답을 광축 둘레로 20° 돌림 | 14 | 최대 10 | 최대 1.6 | |
| 90° / 180° 돌림 | 14 / 14 | 최대 8 / 9 | 최대 0.9 / 1.1 | |
| 광축을 5° / 10° 옮김 | 14 / 14 | 최대 8 / 7 | 최대 1.1 / 0.9 | |
| 다른 사진의 정답 자세 | 182 | 최대 19 | 최대 3.5 | 최대 7.6 |
| 같은 화각, 하늘 무작위 | 420 | 최대 10 | 최대 2.5 | |
| **풀이가 내놓은 오답 후보** (정답과 중심 2° 넘게 다른 후보, V2식으로 "그럴듯한 오답") | 73 | 최대 17 | **최대 7.4** | **최대 15.1** |
| (참고) 5° 돌림 · 2° 옮김 — 거의 맞는 자세 | 28 | 최대 13 | 최대 2.5 | |

- 정답의 최저(18.2)와 오답의 최고(7.4) 사이가 넓게 비었다. 비율(m/e)로는 오답 후보 최고 15.1이 정답 최저 10.6보다 커서 못 가른다.
- **기준**: 꼬리 ≥ 12 이고 m ≥ 10이면 **정답**, 꼬리 < 8이면 **오답**, 그 사이는 **애매**.
- "거의 맞는 자세"(5° 돌림)도 꼬리가 2.5 이하라, 이 기준은 대충 맞는 답을 정답으로 봐주지 않는다.

### 3.2 풀이의 log-odds와 같은 것을 재는가 — 61~150위만으로 다시 보기

풀이는 앞쪽 15~60개(마무리 정밀화는 150개까지)로 검증하므로, 상위 100개로 센 m은 풀이 자신의 점수와 겹친다. 그래서 61~150위 검출만으로도 셌다.

- 샘플 정답 14장: 61~150위 꼬리 0 ~ 42. 검출이 적거나(증슨-04는 60개 남짓) 61위 이후가 대부분 거짓 검출인 사진은 0에 가깝다 → **이 값이 높으면 독립 증거지만, 낮다고 오답은 아니다.**
- 오답 쪽 61~150위 꼬리는 모든 종류에서 최대 3.2.
- 인터넷 사진에서 확신한 61장 중 47장이 61~150위 꼬리 ≥ 3, 37장이 ≥ 5였다 (오답 최대 3.2를 넘는다).

### 3.3 눈으로 확인

확신한 사진마다 별자리 선과 밝은 별 이름(2.6등급까지)을 사진 위에 그려 4장씩 묶어 보았다(scratchpad, 저장소에 넣지 않음).
64장 모두 **맞음**: 북두칠성·카시오페이아·오리온·여름 대삼각형·남십자·전갈·궁수 주전자 등이 사진 속 별 배치와 맞고,
은하수 중심이 궁수·전갈 사이에, 플레이아데스가 성단 위에 놓였다. 008은 달·금성이 플레이아데스 근처(2023-04-23의 실제 배치),
010은 달이 쌍둥이자리 옆(2023-03-30)으로 촬영 날짜와도 맞았다.

**숫자 기준과 눈 판정이 엇갈린 사진**

| 사진 | 숫자 | 눈 | 이유 |
|---|---|---|---|
| 071 | 애매 (m 19, e 3.1, 꼬리 9.1) | 맞음 | 궁수 주전자·전갈 꼬리가 은하수 중심 옆에 정확히 놓인다. 상위 검출 대부분이 5등급보다 어두운 은하수 별이라 m이 낮다 |
| 075 (60초) | 애매 (꼬리 10.1) | 맞음(하늘 쪽) | 하늘 쪽은 맞는데 호수 반사(거울상)가 검출의 절반이라 겹친 별이 덜 나온다 |
| 041·064 | 정답 (꼬리 14.2·17.3) | 맞음(약함) | 별 궤적·어두운 사진이라 별자리 모양을 눈으로 알아보긴 어렵지만, 하늘 쪽 투영 별이 검출 표시와 하나하나 겹친다 |

### 3.4 덧붙인 독립 검산

- **EXIF 초점거리로 잰 시야각** (짧은 변 기준, 풀이와 무관):

  | 사진 | 카메라·렌즈 | EXIF로 계산 | 풀이 |
  |---|---|---|---|
  | 012 | Sony A7 III, 20mm | 61.9° | 62.0° |
  | 046 | Pentax K100D, 35mm 환산 27mm | 47.9° | 46.8° |
  | 048 | Canon 650D, 18mm | 44.9° | 45.1° |
  | 011 | Olympus C5060, 5.7mm | 50.0° | 49.4° |
  | 016 | Nikon D3300, 35mm 환산 16mm, 16:9 | 64.6° | 62.2° |
  | 004 | Canon 40D, 10mm | 73.0° | 69.4° |
  | 071 | Fujifilm X-T5, 16mm, 3:4로 자름 | 약 51° | 47.0° |

  004·071은 초광각의 왜곡이나 크롭 때문에 몇 도 차이가 난다.
- **시각·장소·지평선 풀이와의 일치**: 055는 blind 풀이와 시각·장소 풀이가 각각 확신했고 광축이 0.3° 안으로 같았다. 079·096도 0.2~1.2° 안으로 같았다 (시각·장소 풀이는 확신 못 함, 6장 참고).

## 4. 분류별 결과

분류는 `sources.csv`의 class 첫 단어. "정답·애매·오답"은 3장의 겹친 별 기준(8초 + 60초에서 확신한 것).

| 분류 | 사진 | 8초 확신 | 60초까지 확신 | 정답 | 애매 | 오답 |
|---|---|---|---|---|---|---|
| 은하수 | 33 | 13 (39%) | 16 | 14 | 2 | 0 |
| 별자리 | 21 | 17 (81%) | 17 | 17 | 0 | 0 |
| 오로라 | 12 | 9 (75%) | 9 | 9 | 0 | 0 |
| 구름 | 9 | 6 (67%) | 6 | 6 | 0 | 0 |
| 도시 불빛 | 9 | 6 (67%) | 6 | 6 | 0 | 0 |
| 어안 | 5 | 0 (0%) | 0 | 0 | 0 | 0 |
| 별밭 | 5 | 5 (100%) | 5 | 5 | 0 | 0 |
| 희미함 | 5 | 5 (100%) | 5 | 5 | 0 | 0 |
| 번개구름 | 1 | 0 (0%) | 0 | 0 | 0 | 0 |
| **합계** | **100** | **61** | **64** | **62** | **2** | **0** |

- 별자리·별밭·희미한 사진(밝은 별이 또렷하고 시야가 보통)은 31장 중 27장. 오로라·구름·도시 불빛도 3분의 2 이상.
- 은하수 사진이 가장 약하다(33장 중 13장). 은하수 사진은 대개 초광각이고, 밝은 은하수 배경 위의 밝은 별이 별다움에서 밀리기 쉽다(6장 C·D·G).
- 어안·전천 사진은 0장. 어안 blind 풀이가 한 번도 채택되지 않았다 (100장 모두 확신한 해는 직선투영).

**어떤 경로로 풀렸나** (8초 확신 61장, 확신한 단계): 개선 quad·사진 전체 37, 삼각형·사진 전체 19, 삼각형·위쪽 75%/55% 3, 개선 quad·위쪽 75% 2.
확신한 해의 log-odds는 11.6 ~ 96.4 (중앙 35.7), 시야각은 17.0° ~ 73.7°.

## 5. 사진별 결과

- 결과: 8초 결과 → 재시도(8초) → 60초 진단. "1위 후보"는 확신 못 했을 때 가장 믿을 만한 후보의 log-odds.
- 시간: 8초 측정의 풀이 시간(초, 검출 제외). 확신 못 한 사진은 8초 상한 + 마지막 단계 마무리로 8.8~9.2초.
- 겹친 별: m / e (꼬리 -log10), 상위 100개 검출 기준. 판정: 숫자 / 눈.
- 경로: 확신한 단계 (solver·입력 영역·입력 별 수). 원인 기호는 6장.

| # | 분류 | 출처 | 검출 수 | 결과 | 시간 | 시야각 | log-odds | 겹친 별 | 판정 | 경로 | 실패 원인 |
|---|---|---|---|---|---|---|---|---|---|---|---|
| 001 | 오로라 | [Commons](https://commons.wikimedia.org/wiki/File:Aurora_140519_-_Flickr_-_upsidedown_astronomer.jpg) | 3126 | 모름 (1위 후보 4.0), 재시도 모름, 60초: 25초에 끝, 모름 | 8.93 |  |  |  |  |  | E. 구름 + 풀밭 검출 + 가장 밝은 별이 별다움 0.18로 1,582위 |
| 002 | 오로라 | [Commons](https://commons.wikimedia.org/wiki/File:%D0%9F%D0%BE%D0%BB%D1%8F%D1%80%D0%BD%D0%BE%D0%B5_%D1%81%D0%B8%D1%8F%D0%BD%D0%B8%D0%B5_%D0%AD%D1%82%D0%B2%D0%B0%D0%B9%D0%BD%D1%83%D1%80%D1%8B_20150317.jpg) | 3253 | 확신 | 0.09 | 43.9 | 30.8 | 42/2.9 (32.9) | 정답 / 맞음 | improved·사진 전체·40 |  |
| 003 | 오로라/지상물체 | [Commons](https://commons.wikimedia.org/wiki/File:Amundsen-Scott_marsstation_ray_h.jpg) | 1792 | 확신 | 0.03 | 44.3 | 49.4 | 59/2.8 (55.2) | 정답 / 맞음 | improved·사진 전체·15 |  |
| 004 | 오로라/은하수 | [Commons](https://commons.wikimedia.org/wiki/File:Aurora_Australis_at_the_South_Pole_(4860012723).jpg) | 2744 | 확신 | 1.08 | 69.4 | 56.8 | 83/6.1 (61.9) | 정답 / 맞음 | triangle·사진 전체·25 |  |
| 005 | 오로라/은하수 | [Commons](https://commons.wikimedia.org/wiki/File:Aurora_australis_dancing_over_an_LED_illuminated_igloo.jpg) | 3642 | 확신 | 3.58 | 68.0 | 33.8 | 59/5.4 (39.4) | 정답 / 맞음 | triangle·사진 전체·60 |  |
| 006 | 오로라/은하수 | [Commons](https://commons.wikimedia.org/wiki/File:Milky_Way_and_Aurora_(10414304235).jpg) | 4475 | 모름 (1위 후보 6.8), 재시도 모름, 60초: 20초에 끝, 모름 | 8.95 |  |  |  |  |  | C. 광각 가장자리: 가장자리 12% 검출을 빼면 확신 (시야 69°); 8초 1위 후보도 이미 정답 근처 |
| 007 | 오로라 | [Commons](https://commons.wikimedia.org/wiki/File:Night_sky_over_the_Hill_of_Clibberswick_-_geograph.org.uk_-_4691883.jpg) | 1993 | 확신 | 0.08 | 46.8 | 22.1 | 38/3.6 (25.3) | 정답 / 맞음 | improved·사진 전체·40 |  |
| 008 | 오로라/달/지상물체 | [Commons](https://commons.wikimedia.org/wiki/File:23_April,_2023_Aurora_Borealis_-_52843786953.jpg) | 1090 | 확신 | 0.05 | 36.4 | 22.2 | 32/2.8 (22.2) | 정답 / 맞음 | improved·사진 전체·25 |  |
| 009 | 오로라/어안 | [Commons](https://commons.wikimedia.org/wiki/File:Aurora_Borealis_in_Cleveland,_Ohio_(53713645409).jpg) | 409 | 모름 (1위 후보 5.0), 재시도 모름, 60초: 18초에 끝, 모름 | 8.85 |  |  |  |  |  | B. 어안 (지평선이 크게 휨) |
| 010 | 오로라/달 | [Commons](https://commons.wikimedia.org/wiki/File:Tj%C3%A4ktjus,_Norrbotten_(52806406564).jpg) | 3894 | 확신 | 2.51 | 73.1 | 57.6 | 57/4.8 (40.1) | 정답 / 맞음 | triangle·사진 전체·60 |  |
| 011 | 오로라/달 | [Commons](https://commons.wikimedia.org/wiki/File:Polar_lights_and_moon.jpg) | 1117 | 확신 | 0.06 | 49.4 | 17.2 | 30/4.0 (16.2) | 정답 / 맞음 | improved·사진 전체·25 |  |
| 012 | 오로라/도시광 | [Commons](https://commons.wikimedia.org/wiki/File:Aurora_over_Red_Wing,_Minnesota_(53776610154).jpg) | 1456 | 확신 | 1.46 | 62.0 | 38.7 | 56/5.2 (37.0) | 정답 / 맞음 | triangle·사진 전체·60 |  |
| 013 | 구름/어안 | [Commons](https://commons.wikimedia.org/wiki/File:Big_Dipper_in_Spring_(ann22042c-spring).jpg) | 3669 | 모름 (1위 후보 4.4), 재시도 모름, 60초: 38초에 끝, 모름 | 8.79 |  |  |  |  |  | B. 어안 (지평선이 휨) + 구름·조명 받은 나무 |
| 014 | 구름 | [Commons](https://commons.wikimedia.org/wiki/File:Day_157_Photo365_Off_Topic_(111198079).jpeg) | 1355 | 확신 | 1.35 | 63.9 | 36.6 | 54/3.8 (41.8) | 정답 / 맞음 | triangle·사진 전체·25 |  |
| 015 | 구름/은하수/바다 | [Commons](https://commons.wikimedia.org/wiki/File:Milky_Way_over_Mewstone_-_Devon_(36052577316).jpg) | 3255 | 확신 | 7.70 | 73.7 | 27.7 | 53/6.6 (29.0) | 정답 / 맞음 | triangle·위쪽 75%·25 |  |
| 016 | 구름 | [Commons](https://commons.wikimedia.org/wiki/File:Southern_Night_Sky_(32391872002).jpg) | 1866 | 확신 | 0.13 | 62.2 | 34.3 | 56/6.3 (32.7) | 정답 / 맞음 | improved·사진 전체·60 |  |
| 017 | 구름/지상물체 | [Commons](https://commons.wikimedia.org/wiki/File:Milky_way_galaxy,_lake_Tekapo,_stargazing_view_3.jpg) | 3697 | 확신 | 0.09 | 46.6 | 19.0 | 39/4.4 (23.2) | 정답 / 맞음 | improved·사진 전체·40 |  |
| 018 | 구름/산 | [Commons](https://commons.wikimedia.org/wiki/File:Blue_(31352183).jpeg) | 1314 | 모름 (1위 후보 8.6), 재시도 모름, 60초: 13초에 끝, 모름 | 8.93 |  |  |  |  |  | F. 별이 적고 희미함 + 구름 (별다운 검출 337개) |
| 019 | 구름/눈/지상물체 | [Commons](https://commons.wikimedia.org/wiki/File:Small_house_(12774242885).jpg) | 4626 | 확신 | 1.10 | 51.1 | 19.8 | 30/2.5 (21.8) | 정답 / 맞음 | triangle·사진 전체·25 |  |
| 020 | 구름/나무 | [Commons](https://commons.wikimedia.org/wiki/File:Garden_Route_Game_Lodge-2658.jpg) | 1470 | 확신 | 0.09 | 26.0 | 46.2 | 52/2.1 (52.2) | 정답 / 맞음 | improved·사진 전체·40 |  |
| 021 | 구름/어안/사람 | [Commons](https://commons.wikimedia.org/wiki/File:%E6%98%9F%E3%82%84%E9%9B%B2%E4%B8%8B%E3%81%AE%E6%81%8B%E4%BA%BA_(14914970417).jpg) | 4541 | 모름 (1위 후보 4.9), 재시도 모름, 60초: 44초에 끝, 모름 | 8.89 |  |  |  |  |  | B. 어안 + 구름 |
| 022 | 도시광/오로라 | [Commons](https://commons.wikimedia.org/wiki/File:GXZBAFFWMAAw8YY.jpg) | 560 | 확신 | 0.09 | 57.3 | 27.1 | 35/2.6 (26.5) | 정답 / 맞음 | improved·사진 전체·40 |  |
| 023 | 도시광/구름 | [Commons](https://commons.wikimedia.org/wiki/File:Lighting,_Stars,_and_Houses_(36962357236).jpg) | 1377 | 확신 | 0.09 | 33.6 | 27.7 | 36/1.6 (35.0) | 정답 / 맞음 | improved·사진 전체·40 |  |
| 024 | 도시광/바다 | [Commons](https://commons.wikimedia.org/wiki/File:R%C3%ADa_de_Vigo_-_Lim%C3%A9ns.jpg) | 945 | 확신 | 0.13 | 45.6 | 25.3 | 44/5.0 (25.9) | 정답 / 맞음 | improved·사진 전체·60 |  |
| 025 | 도시광/은하수 | [Commons](https://commons.wikimedia.org/wiki/File:Holy_City_and_the_night_sky.jpg) | 2865 | 모름 (1위 후보 4.9), 재시도 모름, 60초: 22초에 끝, 모름 | 8.87 |  |  |  |  |  | E. 지상 불빛 (다리·도시 조명이 상위 검출) |
| 026 | 도시광/은하수 | [Commons](https://commons.wikimedia.org/wiki/File:Starry_night_sky.jpg) | 2885 | 모름 (1위 후보 4.0), 재시도 모름, 60초: 20초에 끝, 모름 | 8.87 |  |  |  |  |  | E. 지상 불빛 (호숫가 마을 조명·반사) |
| 027 | 도시광/호수 | [Commons](https://commons.wikimedia.org/wiki/File:Milchstra%C3%9Fe_-_Alpen_-_Neuschwanstein_-_panoramio.jpg) | 3428 | 확신 | 8.04 | 65.0 | 44.7 | 57/5.9 (35.3) | 정답 / 맞음 | triangle·위쪽 55%·25 |  |
| 028 | 도시광/산 | [Commons](https://commons.wikimedia.org/wiki/File:Himalayas_under_moon_light_at_Narkanda.jpg) | 392 | 모름 (1위 후보 5.1), 재시도 모름, 60초: 25초에 끝, 모름 | 8.86 |  |  |  |  |  | E. 달빛 박명, 별 거의 없음, 상위 검출 대부분 마을 불빛 |
| 029 | 도시광/주택 | [Commons](https://commons.wikimedia.org/wiki/File:%E5%8D%97%E3%81%AE%E3%81%B2%E3%81%A8%E3%81%A4%E6%98%9F_-_panoramio.jpg) | 525 | 확신 | 0.02 | 31.6 | 30.0 | 32/1.1 (34.6) | 정답 / 맞음 | improved·사진 전체·15 |  |
| 030 | 도시광/은하수/건물 | [Commons](https://commons.wikimedia.org/wiki/File:Milkway_(8554754431).jpg) | 4573 | 확신 | 0.08 | 45.9 | 55.4 | 58/2.8 (53.5) | 정답 / 맞음 | improved·사진 전체·40 |  |
| 031 | 어안/은하수 | [Commons](https://commons.wikimedia.org/wiki/File:A_milky_arc_over_Paranal_(potw1411a-cc-fd).jpg) | 3945 | 모름 (1위 후보 4.7), 재시도 모름, 60초: 38초에 끝, 모름 | 8.97 |  |  |  |  |  | B. 전천 어안 (원형 사진) |
| 032 | 어안/전천 | [Commons](https://commons.wikimedia.org/wiki/File:A_planetary_party_portrait_above_Paranal_(potw2510a).jpg) | 5025 | 모름 (1위 후보 5.1), 재시도 모름, 60초: 30초에 끝, 모름 | 8.84 |  |  |  |  |  | B. 전천 어안 (원형, 글씨·선 표시가 들어간 사진) |
| 033 | 어안/전천/은하수 | [Commons](https://commons.wikimedia.org/wiki/File:A_stop_to_enjoy_the_Chilean_sky_(150123-24_atacama_fullfr_cc).jpg) | 4803 | 모름 (1위 후보 5.8), 재시도 모름, 60초: 38초에 끝, 모름 | 8.83 |  |  |  |  |  | B. 전천 어안 (원형) |
| 034 | 어안/은하수 | [Commons](https://commons.wikimedia.org/wiki/File:The_Milky_Way_Across_the_Zenith_(ann22042s).jpg) | 5307 | 모름 (1위 후보 5.1), 재시도 모름, 60초: 39초에 끝, 모름 | 8.98 |  |  |  |  |  | B. 전천 어안 (원형) |
| 035 | 어안/은하수/광해 | [Commons](https://commons.wikimedia.org/wiki/File:Milkyway_at_Cape_Leveque.jpg) | 5654 | 모름 (1위 후보 4.8), 재시도 모름, 60초: 30초에 끝, 모름 | 8.82 |  |  |  |  |  | B. 어안 (출처 분류) + 광해 |
| 036 | 별자리/별밭 | [Commons](https://commons.wikimedia.org/wiki/File:Ground-based,_wide-field_image_of_the_ZwCl0024%2B1652_region_(heic0709e).jpg) | 4556 | 확신 | 0.08 | 53.3 | 74.3 | 72/2.1 (81.1) | 정답 / 맞음 | improved·사진 전체·40 |  |
| 037 | 별자리/나무 | [Commons](https://commons.wikimedia.org/wiki/File:Night-sky-stars-forest-trees_-_West_Virginia_-_ForestWander.jpg) | 1549 | 확신 | 0.13 | 48.4 | 35.7 | 42/2.3 (36.7) | 정답 / 맞음 | triangle·사진 전체·15 |  |
| 038 | 별자리/나무/어두움 | [Commons](https://commons.wikimedia.org/wiki/File:Big_Dipper_at_Colter_Bay_Campground_(9477880938).jpg) | 4322 | 확신 | 0.05 | 45.2 | 20.2 | 29/1.6 (25.5) | 정답 / 맞음 | improved·사진 전체·25 |  |
| 039 | 별자리/별밭 | [Commons](https://commons.wikimedia.org/wiki/File:BigdipISS.jpg) | 2661 | 모름 (1위 후보 4.0), 재시도 모름, 60초: 36초에 끝, 모름 | 8.83 |  |  |  |  |  | G. 원인 미확정: 북두칠성 별밭, 밝은 별 일부가 상위에 없음 (진단 실험으로도 안 풀림) |
| 040 | 별자리/나뭇가지 | [Commons](https://commons.wikimedia.org/wiki/File:Bright_Stars_of_Milky_Way_on_the_Dark_blue_Sky_of_Astronomy.jpg) | 3831 | 확신 | 0.05 | 25.2 | 28.0 | 35/1.9 (30.8) | 정답 / 맞음 | improved·사진 전체·25 |  |
| 041 | 별자리/산 | [Commons](https://commons.wikimedia.org/wiki/File:Starry_night_at_Mount_Everest.jpg) | 799 | 확신 | 0.03 | 17.0 | 11.7 | 16/0.9 (14.2) | 정답 / 맞음(별 궤적, 별자리 모양은 알아보기 어려움 — 투영 별이 검출과 겹침) | improved·사진 전체·15 |  |
| 042 | 별자리/오리온/논 | [Commons](https://commons.wikimedia.org/wiki/File:Watchtower_and_Paddy_Fields_Under_the_Starry_Sky_(ann22042j).jpg) | 2417 | 확신 | 0.02 | 46.8 | 60.8 | 74/3.7 (66.7) | 정답 / 맞음 | improved·사진 전체·15 |  |
| 043 | 별밭 | [Commons](https://commons.wikimedia.org/wiki/File:Anfal_Shamsudeen_2015-08-18_(Unsplash).jpg) | 4911 | 확신 | 0.08 | 38.9 | 48.1 | 59/2.9 (53.9) | 정답 / 맞음 | improved·사진 전체·40 |  |
| 044 | 별자리/산 | [Commons](https://commons.wikimedia.org/wiki/File:Shiretoko_Five_Lakes,_Hokkaido;_October_2018_(01).jpg) | 883 | 확신 | 0.09 | 43.5 | 49.9 | 54/2.0 (55.6) | 정답 / 맞음 | improved·사진 전체·40 |  |
| 045 | 별자리/플레이아데스/송전탑 | [Commons](https://commons.wikimedia.org/wiki/File:Seven_sisters_%E3%81%99%E3%81%B0%E3%82%8B_-_panoramio.jpg) | 4156 | 모름 (1위 후보 5.4), 재시도 모름, 60초: 33초에 끝, 모름 | 8.81 |  |  |  |  |  | F. 좁은 시야(약 22°) 플레이아데스, 5등급 이하 별이 적음, 작은 사진(1240px) |
| 046 | 별밭/은하수약함 | [Commons](https://commons.wikimedia.org/wiki/File:%E5%A4%8F%E3%81%AE%E5%A4%A7%E4%B8%89%E8%A7%92%E5%BD%A2.JPG) | 2972 | 확신 | 0.04 | 46.8 | 96.4 | 78/3.1 (77.9) | 정답 / 맞음 | improved·사진 전체·25 |  |
| 047 | 별자리/바위/호수 | [Commons](https://commons.wikimedia.org/wiki/File:%22Shaman%22_rock.jpg) | 3699 | 확신 | 0.09 | 25.2 | 15.2 | 19/1.1 (16.9) | 정답 / 맞음 | improved·사진 전체·40 |  |
| 048 | 별자리/건물 | [Commons](https://commons.wikimedia.org/wiki/File:%D0%9D%D0%BE%D1%87%D0%BD%D0%BE%D0%B5_%D0%BD%D0%B5%D0%B1%D0%BE_%D0%BD%D0%B0%D0%B4_%D0%9F%D0%BE%D0%BA%D1%80%D0%BE%D0%B2%D1%81%D0%BA%D0%BE%D0%B9_%D1%86%D0%B5%D1%80%D0%BA%D0%BE%D0%B2%D1%8C%D1%8E.jpg) | 1302 | 확신 | 0.12 | 45.1 | 25.3 | 38/2.5 (30.5) | 정답 / 맞음 | improved·사진 전체·60 |  |
| 049 | 별자리/오리온/나무 | [Commons](https://commons.wikimedia.org/wiki/File:The_night_scenery_of_Siberian.jpg) | 2194 | 확신 | 0.03 | 24.5 | 36.0 | 34/1.2 (35.7) | 정답 / 맞음 | improved·사진 전체·15 |  |
| 050 | 별밭 | [Commons](https://commons.wikimedia.org/wiki/File:Thailand_2016_(221_of_422)_(31522460544).jpg) | 3398 | 확신 | 0.26 | 48.3 | 69.1 | 68/2.1 (75.8) | 정답 / 맞음 | triangle·사진 전체·15 |  |
| 051 | 별밭 | [Commons](https://commons.wikimedia.org/wiki/File:Hadleigh_night%3D0032rs_(15321520963).jpg) | 3464 | 확신 | 0.08 | 40.7 | 51.7 | 51/2.0 (51.3) | 정답 / 맞음 | improved·사진 전체·40 |  |
| 052 | 별자리/자동차 | [Commons](https://commons.wikimedia.org/wiki/File:Orion_rising_over_Hagdale,_Baltasound_-_geograph.org.uk_-_4252754.jpg) | 1430 | 확신 | 0.04 | 40.7 | 53.9 | 62/3.2 (55.9) | 정답 / 맞음 | improved·사진 전체·25 |  |
| 053 | 별밭 | [Commons](https://commons.wikimedia.org/wiki/File:Hadleigh_night%3D0014rs_(15941152625).jpg) | 7675 | 확신 | 0.04 | 47.0 | 59.2 | 73/3.9 (64.2) | 정답 / 맞음 | improved·사진 전체·25 |  |
| 054 | 별자리/나무/박명 | [Commons](https://commons.wikimedia.org/wiki/File:Distant_ridgetop.jpg) | 2401 | 확신 | 0.04 | 40.4 | 38.7 | 48/2.5 (43.5) | 정답 / 맞음 | improved·사진 전체·25 |  |
| 055 | 별자리/바위 | [Commons](https://commons.wikimedia.org/wiki/File:Night_sky_through_the_North_Window_-_Arches_National_Park_-_Grand_County,_Utah,_USA_-_10_April_2015.jpg) | 3795 | 확신 | 0.42 | 69.6 | 35.7 | 53/6.6 (29.2) | 정답 / 맞음 | triangle·사진 전체·15 |  |
| 056 | 별자리/어두움 | [Commons](https://commons.wikimedia.org/wiki/File:Night_sky_through_branches_(24491044569).jpg) | 3244 | 확신 | 0.02 | 46.7 | 36.5 | 47/2.5 (42.2) | 정답 / 맞음 | improved·사진 전체·15 |  |
| 057 | 별자리/나뭇가지 | [Commons](https://commons.wikimedia.org/wiki/File:Night_sky_through_branches_(24490328969).jpg) | 5360 | 확신 | 0.05 | 46.7 | 36.2 | 48/2.4 (43.9) | 정답 / 맞음 | improved·사진 전체·25 |  |
| 058 | 별자리/오리온(좁은 시야) | [Commons](https://commons.wikimedia.org/wiki/File:Orion-belt.jpg) | 3937 | 모름 (1위 후보 4.3), 재시도 모름, 60초: 40초에 끝, 모름 | 8.96 |  |  |  |  |  | D. 좁은 시야(5° 안팎, 오리온 벨트 확대) + 벨트 별 세 개가 상위 150개 밖 |
| 059 | 별자리/구조물 | [Commons](https://commons.wikimedia.org/wiki/File:Constelaci%C3%B3n_de_Ori%C3%B3n_en_la_Zona_del_Silencio.jpg) | 2824 | 확신 | 0.07 | 44.7 | 79.7 | 83/3.6 (80.0) | 정답 / 맞음 | improved·사진 전체·25 |  |
| 060 | 별자리/오리온/눈/건물 | [Commons](https://commons.wikimedia.org/wiki/File:Astronomer.jpg) | 3482 | 확신 | 0.03 | 48.9 | 47.9 | 62/3.5 (53.6) | 정답 / 맞음 | improved·사진 전체·15 |  |
| 061 | 별자리/오리온/밝은하늘 | [Commons](https://commons.wikimedia.org/wiki/File:The_night_sky_on_October_22,_2022.jpg) | 2228 | 모름 (1위 후보 7.1), 재시도 모름, 60초: 36초에 끝, 모름 | 9.00 |  |  |  |  |  | D. 좁은 시야(7°) + 밝은 별이 별다움에서 밀림: 별다움을 지우면 정답(오리온 벨트·M42) 확신 |
| 062 | 희미함/휴대폰느낌/나무 | [Commons](https://commons.wikimedia.org/wiki/File:Nightsky,_Wayanad_2.jpg) | 1454 | 확신 | 0.09 | 53.1 | 36.0 | 51/3.3 (41.3) | 정답 / 맞음 | improved·사진 전체·40 |  |
| 063 | 희미함/나무 | [Commons](https://commons.wikimedia.org/wiki/File:Night_sky_in_Semion.jpg) | 1473 | 확신 | 4.81 | 56.5 | 53.9 | 55/2.7 (50.5) | 정답 / 맞음 | improved·위쪽 75%·40 |  |
| 064 | 희미함/산 | [Commons](https://commons.wikimedia.org/wiki/File:Thailand_2016_(325_of_422)_(32213688432).jpg) | 8805 | 확신 | 0.04 | 35.3 | 11.7 | 18/0.9 (17.3) | 정답 / 맞음(어두운 사진, 하늘 쪽 투영 별 10여 개가 검출과 겹침) | improved·사진 전체·25 |  |
| 065 | 희미함/산 | [Commons](https://commons.wikimedia.org/wiki/File:Bischofswiesen_(DE),_Watzmann_--_2024_--_0048.jpg) | 3841 | 확신 | 2.13 | 60.4 | 21.9 | 40/3.8 (26.4) | 정답 / 맞음 | triangle·사진 전체·60 |  |
| 066 | 희미함/구름/산 | [Commons](https://commons.wikimedia.org/wiki/File:Milky_Way_Bromo.jpg) | 5033 | 확신 | 0.05 | 54.0 | 54.4 | 55/4.1 (40.9) | 정답 / 맞음 | improved·사진 전체·25 |  |
| 067 | 번개구름/지상물체 | [Commons](https://commons.wikimedia.org/wiki/File:202506_%E6%B7%B1%E5%A4%9C%E5%9C%A8%E5%86%B7%E6%B0%B4%E5%9D%91%E9%81%8A%E5%AE%A2%E6%9C%8D%E5%8B%99%E7%AB%99%E7%9E%AD%E6%9C%9B%E7%9A%84%E7%A9%8D%E9%9B%A8%E9%9B%B2%E6%89%93%E9%9B%B7_03.jpg) | 1175 | 모름 (1위 후보 6.5), 재시도 모름, 60초: 23초에 끝, 모름 | 8.96 |  |  |  |  |  | C. 번개 구름 + 가장자리: 가장자리 빼면 log-odds 9.8 (겹친 별 지표 애매) |
| 068 | 은하수/산 | [Commons](https://commons.wikimedia.org/wiki/File:035_Vertical_panorama_of_the_Milky_Way_during_Perseids_seen_from_Oeschinensee_Photo_by_Giles_Laurent.jpg) | 7463 | 모름 (1위 후보 4.6), 재시도 모름, 60초: 45초에 끝, 모름 | 8.88 |  |  |  |  |  | B. 세로 파노라마 (여러 장을 이어 붙여 직선투영이 아님) |
| 069 | 은하수/천문대/레이저 | [Commons](https://commons.wikimedia.org/wiki/File:Gemini_North%27s_Laser_%26_the_Big_Dipper_(gemini-gemini-laser-24feb10).jpg) | 406 | 확신 | 0.49 | 65.2 | 54.6 | 70/3.9 (60.1) | 정답 / 맞음 | triangle·사진 전체·15 |  |
| 070 | 은하수/모닥불 | [Commons](https://commons.wikimedia.org/wiki/File:Felix_Plakolb_2016_(Unsplash).jpg) | 2177 | 모름 (1위 후보 7.5), 재시도 모름, 60초: 16초에 끝, 모름 | 8.91 |  |  |  |  |  | E. 구름 + 모닥불·차 (1위 후보 겹친 별 지표 11.8로 애매) |
| 071 | 은하수/산/호수 | [Commons](https://commons.wikimedia.org/wiki/File:Milky_Way_Over_Lac_de_Gaube.jpg) | 5594 | 확신 | 0.06 | 47.0 | 11.6 | 19/3.1 (9.1) | 애매 / 맞음(궁수 주전자·전갈 꼬리가 은하수 중심 옆에 정확히) | improved·사진 전체·25 |  |
| 072 | 은하수/텐트 | [Commons](https://commons.wikimedia.org/wiki/File:%D0%9D%D1%96%D1%87_%D0%BD%D0%B0_%D0%BE%D0%B7%D0%B5%D1%80%D1%96_%D0%A1%D0%B8%D0%B2%D0%B0%D1%88.jpg) | 5241 | 모름 (1위 후보 6.2), 재시도 모름, 60초: 14초에 끝, 모름 | 8.84 |  |  |  |  |  | G. 원인 미확정: 은하수 광각 + 수평선 불빛 |
| 073 | 은하수/바다 | [Commons](https://commons.wikimedia.org/wiki/File:Rise_up!_(Unsplash).jpg) | 5153 | 모름 (1위 후보 6.7), 재시도 모름, 60초: 29초에 끝, 모름 | 8.87 |  |  |  |  |  | G. 원인 미확정: 은하수 광각 (밝은 은하수 중심) |
| 074 | 은하수/등대/바다 | [Commons](https://commons.wikimedia.org/wiki/File:Nubble_Milky_Way_(33245514280).jpg) | 3377 | 모름 (1위 후보 4.5), 재시도 모름, 60초: 23초에 끝, 모름 | 8.91 |  |  |  |  |  | G. 원인 미확정: 은하수 광각 + 전선 |
| 075 | 은하수/산/호수 | [Commons](https://commons.wikimedia.org/wiki/File:Milky_way_over_nanga_parbat_-_fairy_meadows.jpg) | 2926 | 모름 (1위 후보 3.7), 재시도 모름, 60초: 24.8초에 확신 | 8.87 | 69.4 | 23.1 | 31/7.4 (10.1) | 애매 / 맞음(하늘 쪽), 호수 반사에도 별이 투영됨 |  | A. 8초 부족 (60초 상한에서 24.8초에 확신, 호수 반사가 검출 절반) |
| 076 | 은하수/나무 | [Commons](https://commons.wikimedia.org/wiki/File:The_tree_of_sahara.jpg) | 5413 | 확신 | 0.08 | 54.1 | 44.6 | 61/3.7 (51.0) | 정답 / 맞음 | improved·사진 전체·40 |  |
| 077 | 은하수/바위/광해 | [Commons](https://commons.wikimedia.org/wiki/File:Sierras_de_Azul.jpg) | 4551 | 모름 (1위 후보 4.6), 재시도 모름, 60초: 15초에 끝, 모름 | 8.89 |  |  |  |  |  | C. 광각 가장자리: 가장자리 20% 빼면 확신 (시야 67.5°) |
| 078 | 은하수/야자수 | [Commons](https://commons.wikimedia.org/wiki/File:El_Palmar,_Entre_R%C3%ADos._(36409226500).jpg) | 4936 | 모름 (1위 후보 4.9), 재시도 모름, 60초: 10.2초에 확신 | 8.88 | 60.1 | 34.4 | 65/6.5 (40.7) | 정답 / 맞음 |  | A. 8초 부족 (60초 상한에서 10.2초에 확신) |
| 079 | 은하수/나무 | [Commons](https://commons.wikimedia.org/wiki/File:S_k_y_s_c_a_p_e_s_(33731293231).jpg) | 4437 | 확신 | 0.69 | 62.6 | 36.8 | 59/4.9 (41.7) | 정답 / 맞음 | triangle·사진 전체·15 |  |
| 080 | 은하수/텐트/사람 | [Commons](https://commons.wikimedia.org/wiki/File:Milky_Way_from_Los_Gigantes.jpg) | 6292 | 확신 | 3.84 | 64.8 | 17.7 | 41/5.6 (21.2) | 정답 / 맞음 | triangle·사진 전체·60 |  |
| 081 | 은하수/사람 | [Commons](https://commons.wikimedia.org/wiki/File:Starry_Starry_Night_(9416274426).jpg) | 2874 | 모름 (1위 후보 4.7), 재시도 모름, 60초: 20초에 끝, 모름 | 8.93 |  |  |  |  |  | G. 원인 미확정: 은하수 광각, 별 궤적 |
| 082 | 은하수/전봇대 | [Commons](https://commons.wikimedia.org/wiki/File:Connections_(161050315).jpeg) | 6981 | 확신 | 1.42 | 52.0 | 18.9 | 40/5.1 (21.8) | 정답 / 맞음 | triangle·사진 전체·60 |  |
| 083 | 은하수/나무/산 | [Commons](https://commons.wikimedia.org/wiki/File:Cazneaux%27s_tree-Wiki.jpg) | 6430 | 모름 (1위 후보 5.1), 재시도 모름, 60초: 25초에 끝, 모름 | 8.89 |  |  |  |  |  | G. 원인 미확정: 은하수 광각, 상위 검출이 좌우 가장자리에 몰림 |
| 084 | 은하수/나무 | [Commons](https://commons.wikimedia.org/wiki/File:La_v%C3%ADa_L%C3%A1ctea_en_el_horizonte.jpg) | 3687 | 확신 | 1.03 | 46.6 | 21.2 | 39/3.7 (25.7) | 정답 / 맞음 | triangle·사진 전체·25 |  |
| 085 | 은하수/다리 | [Commons](https://commons.wikimedia.org/wiki/File:O_caminho_das_Estrelas.jpg) | 3237 | 확신 | 4.04 | 68.5 | 13.1 | 39/6.7 (16.9) | 정답 / 맞음 | triangle·사진 전체·60 |  |
| 086 | 은하수/산/눈 | [Commons](https://commons.wikimedia.org/wiki/File:Milky_Road_(123956845).jpeg) | 6305 | 모름 (1위 후보 5.0), 재시도 모름, 60초: 16초에 끝, 모름 | 8.83 |  |  |  |  |  | G. 원인 미확정: 은하수 정사각 크롭, 상위 검출이 위 가장자리에 몰림 |
| 087 | 은하수/사람/광해 | [Commons](https://commons.wikimedia.org/wiki/File:Star_Party_(iau0918a).jpg) | 3302 | 모름 (1위 후보 3.7), 재시도 모름, 60초: 33초에 끝, 모름 | 8.98 |  |  |  |  |  | B. 어안 의심 (지평선이 크게 휨) + 사람·불빛 |
| 088 | 은하수/건물 | [Commons](https://commons.wikimedia.org/wiki/File:A_Milky_Way_for_dinner%3F_(potw2449a).jpg) | 5403 | 모름 (1위 후보 4.2), 재시도 모름, 60초: 25초에 끝, 모름 | 8.86 |  |  |  |  |  | D. 밝은 별이 별다움에서 밀림: 별다움을 지우면 궁수자리 확신 (밝은 은하수 중심 배경) |
| 089 | 은하수/사람/오로라 | [Commons](https://commons.wikimedia.org/wiki/File:Waiting_(139918355).jpeg) | 5625 | 모름 (1위 후보 5.4), 재시도 모름, 60초: 30초에 끝, 모름 | 9.00 |  |  |  |  |  | B. 초광각: EXIF 14mm 풀프레임 세로 → 짧은 변 시야 81°, 후보(10~75°) 밖 |
| 090 | 은하수/교회 | [Commons](https://commons.wikimedia.org/wiki/File:Milky_Way_at_Dallapalli_01.jpg) | 4698 | 모름 (1위 후보 4.9), 재시도 모름, 60초: 32초에 끝, 모름 | 8.98 |  |  |  |  |  | C. 광각 가장자리: 가장자리 12% 빼면 확신 (시야 62°), 유성 궤적 여러 개 |
| 091 | 은하수/구름/논 | [Commons](https://commons.wikimedia.org/wiki/File:Alaksi_bimasakti_di_atas_gunung_pedesaan.jpg) | 3066 | 모름 (1위 후보 5.0), 재시도 모름, 60초: 22초에 끝, 모름 | 9.15 |  |  |  |  |  | G. 원인 미확정: 은하수 광각 + 구름 |
| 092 | 은하수/야자수/건물 | [Commons](https://commons.wikimedia.org/wiki/File:Photograph_of_Milky_Way_in_Lombok;_July_2019.jpg) | 4398 | 모름 (1위 후보 6.4), 재시도 모름, 60초: 10.5초에 확신 | 8.86 | 53.4 | 21.7 | 32/3.4 (20.0) | 정답 / 맞음 |  | A. 8초 부족 (8초 때 1위 후보가 이미 정답, 10.5초에 확신) |
| 093 | 은하수/주택 | [Commons](https://commons.wikimedia.org/wiki/File:Night_Sky_Over_Sunrise_Hut_(52185617470).jpg) | 7301 | 모름 (1위 후보 5.2), 재시도 모름, 60초: 27초에 끝, 모름 | 8.90 |  |  |  |  |  | G. 원인 미확정: 세로 은하수 광각, 상위 검출이 위 구석에 몰림 |
| 094 | 은하수/나무 | [Commons](https://commons.wikimedia.org/wiki/File:Flor_Via_l%C3%A1ctea.jpg) | 2201 | 확신 | 1.23 | 65.9 | 17.3 | 35/5.9 (15.6) | 정답 / 맞음 | triangle·사진 전체·25 |  |
| 095 | 은하수/등대/구름 | [Commons](https://commons.wikimedia.org/wiki/File:%E7%B6%A0%E5%B3%B6%E9%8A%80%E6%B2%B3_(30204387228).jpg) | 4582 | 확신 | 5.77 | 65.6 | 28.9 | 47/3.8 (33.8) | 정답 / 맞음 | triangle·사진 전체·60 |  |
| 096 | 은하수/표지판 | [Commons](https://commons.wikimedia.org/wiki/File:%E5%90%88%E6%AD%A1%E5%B1%B1%E9%8A%80%E6%B2%B3_(8568122533).jpg) | 5540 | 확신 | 6.88 | 69.8 | 31.9 | 53/6.3 (30.0) | 정답 / 맞음 | triangle·위쪽 75%·60 |  |
| 097 | 은하수/화산/구름 | [Commons](https://commons.wikimedia.org/wiki/File:Mayon_Volcano_with_Galactic_Core.jpg) | 4275 | 모름 (1위 후보 3.5), 재시도 모름, 60초: 21초에 끝, 모름 | 8.85 |  |  |  |  |  | G. 원인 미확정: 은하수 + 화산 아래 불빛 |
| 098 | 은하수/사람/말 | [Commons](https://commons.wikimedia.org/wiki/File:Keeping_warm_under_the_cold_night_at_mountain.jpg) | 5741 | 모름 (1위 후보 4.5), 재시도 모름, 60초: 35초에 끝, 모름 | 8.87 |  |  |  |  |  | G. 원인 미확정: 세로 은하수 광각 + 모닥불 |
| 099 | 은하수/아치/사람 | [Commons](https://commons.wikimedia.org/wiki/File:Artistic_Photograph_of_Delicate_Arch.jpg) | 2897 | 확신 | 0.78 | 61.1 | 29.3 | 53/5.3 (33.5) | 정답 / 맞음 | triangle·사진 전체·25 |  |
| 100 | 은하수/사람/자동차 | [Commons](https://commons.wikimedia.org/wiki/File:Star_Party_at_Cave_Area_parking_lot_(wide)_(36674726980).jpg) | 5207 | 확신 | 4.94 | 51.8 | 14.5 | 32/4.2 (17.3) | 정답 / 맞음 | improved·위쪽 75%·60 |  |
## 6. 실패 분석

8초에 확신 못 한 39장을 증거로 나눴다. 증거는 ① 검출 상위 60·61~100·101~150개를 사진에 그려 눈으로 본 것,
② 60초 상한 결과, ③ 진단 실험(아래), ④ EXIF·출처 분류다.

### 6.1 진단 실험 (알고리즘 코드는 그대로, 넣는 검출 목록만 바꿈)

| 실험 | 바꾼 것 | 새로 확신 (39장 중) |
|---|---|---|
| 시간 60초 | 시간 상한만 | 075·078·092 (3장, 10~25초) |
| 별다움 지우기 | 검출의 `ringContrast`를 지워 밝기 순으로만 | 061·088 (2장, 상위 100 기준 꼬리 14.4·20.2, 눈으로도 맞음) |
| 별다움 기준 완화 | `ringContrast`를 반으로 (기준 0.12 → 0.24 효과) | 061·088 (같은 2장) |
| 가장자리 빼기 | 사진 가장자리 12% / 20% / 25% 띠의 검출을 뺌 | 006·067·077·090 (4장, 093은 꼬리 6.3이라 제외) |
| 칸마다 고르기 | 4×3 칸마다 우선순위 앞 5개를 맨 앞으로 | 0장 |

- 별다움을 지워도 못 푼 39장 중 2장만 풀렸다 (풀린 사진에는 돌려 보지 않았다). 별다움을 통째로 빼는 게 답이 아니고, 밝은 별 일부를 잘못 밀어내는 게 문제다.
- 칸마다 고르기(공간 분산)는 효과가 없었다.

### 6.2 원인별 개수와 대표 사례

| 기호 | 원인 | 사진 수 | 사진 | 대표 사례·증거 |
|---|---|---|---|---|
| A | 8초 부족 | 3 | 075·078·092 | 092는 8초 때 이미 1위 후보가 정답(꼬리 18.6)이었지만 log-odds 6.4라 확신 못 함. 60초면 10.5초에 정밀화로 21.7 |
| B | 어안·전천·초광각·파노라마 (직선투영 모델 밖) | 11 | 009·013·021·031·032·033·034·035·068·087·089 | 원형 전천 사진 4장, 지평선이 크게 휜 사진, 세로 파노라마(068). 089는 EXIF 14mm 풀프레임 세로 → 짧은 변 81°로 후보(10~75°) 밖. 어안 blind 풀이는 모두 채택 기준(inlier 25·RMS 6px) 미달 |
| C | 광각 가장자리 왜곡 | 4 | 006·067·077·090 | 가장자리 검출을 빼면 확신. 시야 62~69°. 못 푼 사진은 상위 60개 중 가장자리 12% 띠에 있는 비율이 평균 0.52 (풀린 사진 0.45, 띠 넓이 0.42) |
| D | 밝은 별이 별다움 기준에서 밀림 (+ 좁은 시야) | 3 | 058·061·088 | 061: 오리온 벨트 세 별·M42가 화면에 있는데 벨트 별이 상위에 없음. 별다움을 지우면 시야 6.9°로 정답. 058: 벨트·말머리 성운 확대(시야는 눈어림 5° 안팎), 벨트 별이 상위 150개 밖 |
| E | 지상 불빛·구름·박명이 검출을 차지 | 5 | 001·025·026·028·070 | 001: 가장 밝은 별이 별다움 0.18로 1,582위, 상위에는 풀밭·구름 가장자리 검출. 028: 달빛 박명, 상위 대부분 마을 불빛 |
| F | 별이 적음·좁은 시야 | 2 | 018·045 | 018: 별다운 검출 337개, 구름. 045: 플레이아데스 확대(약 22°), 1,240px 컴팩트 카메라, 5등급 이하 별이 몇 개 없음 |
| G | 은하수 광각, 원인 미확정 | 11 | 039·072·073·074·081·083·086·091·093·097·098 | 60초로도, 진단 실험으로도 안 풀림. 공통점: 검출 2,600~7,300개로 많고, 상위 검출이 사진 구석·가장자리에 몰리고, 밝은 행성·별이 상위에 없는 경우가 보인다(083·090·072). 초광각일 가능성이 크지만 EXIF가 없어 확인 못 함 |

**풀린 사진으로 잰 "밝은 별 밀림"의 크기** (확신 61장의 답으로 3등급보다 밝은 별을 투영하고, 반경 안의 검출이 앱 우선순위 몇 위인지):
검출과 겹친 915개 중 상위 60 안 535개(58%), 61~150위 60개, **150위 밖 320개(35%)**. 150위 밖의 3분의 2(212개)는 별다움 0.12 이상이라 밀렸고, 52개는 줄지음으로 밀렸다.
1등급보다 밝은 77개 중에서도 15개가 150위 밖이었다. (지평선 아래에 투영된 별이 우연히 지상 검출과 겹친 경우가 섞여 있어 대략적인 값이다.)
풀린 사진에서도 밝은 별이 상당수 빠진 채 나머지 별로 풀렸다는 뜻이고, 별이 적은 사진·좁은 시야에서는 이게 실패로 이어진다(D).

**시각·장소·지평선 풀이** (sources.csv에 GPS가 있는 28장): 날짜만 있어 시각이 없는 7장, 지평선 자동 제안이 없는 3장(021·061·082)을 빼고 18장에 돌렸다.
시각은 카메라 현지 시각으로 보고 시간대는 경도/15로 어림했고, 앱 기본 범위(3시간 전~1시간 30분 뒤)가 그 앞뒤를 덮게 두었다.
확신은 055 하나(blind와 0.3° 안). 079·096은 blind 답과 0.2~1.2° 안으로 같았지만 확신 못 했고, 나머지 15장은 다른 자세(광축 35~114° 차이)였다.
blind로 못 푼 8장(035·067·072·078·083·086·089·093)은 하나도 풀리지 않았다. 원인 후보: 자동 지평선이 나무·산 능선을 잡음(040은 기울어진 직선), Commons 시각의 시간대·정확도를 모름, 초광각.

## 7. 고치려면 어디를 손대야 할지 (후보, 고치지 않음)

1. **8초 안에 마무리하기 (A, 3장)** — `src/search/solvePhoto.ts`: 시간이 다 됐을 때 1위 후보에도 `polish`(마무리 정밀화)를 한 번 돌리기. 092는 8초 때 1위 후보가 이미 정답이었다. journey 30장의 "삼각형 검증 전 값싼 거르기"도 같은 쪽.
2. **가운데 영역 입력 (C, 4장)** — `SEARCH_REGIONS`(solvePhoto.ts)는 지면을 빼는 "위쪽 n%"만 있다. 가장자리를 빼는 "가운데 n%" 영역을 더하면 광각 왜곡을 피한다. 진단에서 가장자리 12~25%를 빼면 4장이 풀렸다.
3. **밝은 별을 별다움으로 밀어내지 않기 (D·E 일부)** — `src/search/utils/selectStars.ts`의 `isStarlike`/`byStarPriority`, `src/search/detectCore.ts`의 `ringContrast`. 밝게 번진 별은 주변 고리가 밝아 별답지 않게 나온다. 밝기 상위 몇 개는 별다움과 상관없이 앞에 두거나, 고리 반경을 별 크기에 맞추는 방법. 풀린 사진에서도 3등급보다 밝은 별의 35%가 150위 밖이었다.
4. **어안·초광각 (B, 11장)** — `src/search/fisheyeSolve.ts`·`FISHEYE_ACCEPT`(solvePhoto.ts): 이번 100장에서 어안 풀이가 한 번도 채택되지 않았다. 원형 전천 사진(검은 테두리)을 알아보고 어안 경로로 보내기, 직선투영 FOV 후보를 75° 위로 넓히거나 왜곡 계수(k1)를 직선 풀이에도 두기.
5. **좁은 시야 (D·F)** — FOV 후보 하한 10°와 5등급 카탈로그: 058(5°)·061(7°)처럼 망원 사진은 카탈로그 별이 몇 개뿐이다. 카탈로그 등급을 넓히면 quad가 폭발하므로(CLAUDE.md) 좁은 시야 전용으로만 어두운 별을 쓰는 방법.
6. **지상 불빛·반사 (E, 075)** — 이미 있는 자동 지평선(`horizonDetect.ts`)을 blind 풀이 입력에도 써서 지평선 아래 검출을 빼기. 호수 반사(075)는 지평선 아래라 같이 빠진다.

## 8. 한계

- 판정에 쓴 상위 100개 검출은 풀이가 쓴 별(상위 15~60개)을 포함한다. 그래서 61~150위로 따로 쟀지만, 검출이 적은 사진에서는 그 값의 힘이 약하다. 눈 판정은 800px로 줄인 그림이다.
- "오답" 보정에 쓴 V2식 오답은 실제 V2 코드가 아니라, 지금 풀이가 내놓은 그럴듯한 오답 후보(73개)다.
- 원인 분류는 그림을 보고 사람이 정한 것이고, G(11장)는 원인을 확정하지 못했다. 진단 실험은 "그것만 바꾸면 풀린다"를 보일 뿐 유일한 원인이라는 증거는 아니다.
- 사진은 Commons의 1,920px 썸네일(재압축)이고 대부분 EXIF가 없다. 원본이나 휴대폰 사진과는 다를 수 있다. Commons에 올라온 사진은 보정·합성이 많은 "작품 사진" 쪽으로 치우친다.
- 시간은 M3 Pro node 측정이다. 브라우저 Worker는 더 느릴 수 있다. 60초 진단은 4개를 나란히 돌렸다.
- 시각·장소 풀이는 Commons 시각의 시간대를 경도로 어림했다. 앱에서 사람이 정확한 시각을 넣으면 결과가 다를 수 있다.

## 9. 다시 돌리기 (스크립트)

스크립트는 세션 임시 폴더 `/private/tmp/claude-504/-Users-ybbarng-personal-projects-star-byb-kr/0b1a2036-9418-4591-b809-960b2f90cd84/scratchpad/validate/`에 있다(저장소에 넣지 않음, 임시 폴더라 지워질 수 있다).
저장소 루트에서 `node_modules/.bin/tsx --tsconfig tsconfig.json <스크립트> ...`로 돌린다.

| 스크립트 | 하는 일 | 사용 |
|---|---|---|
| `common.ts` | 검출 캐시, 겹친 별(m·e·꼬리) 계산, CSV 읽기 | (다른 스크립트가 씀) |
| `calibrate.ts` · `calibSummary.ts` | 샘플 14장으로 판정 기준 보정 | 인자 없음 |
| `detectAll.ts` | 검출만 미리 해서 캐시 | `detectAll.ts <폴더> <조각/조각 수>` |
| `run.ts` | 앱과 같은 풀이 + 판정 값 기록 | `run.ts <폴더> <시간 상한 ms> <출력 이름> [조각/조각 수] [파일 목록 json]` |
| `overlay.ts` | 별자리 선·별 이름·검출 표시 그림 | `[NOBOX=1] overlay.ts <폴더> <결과 json> <solved\|cand\|det> [파일,…]` |
| `diag.ts` | 진단 실험 (noring·ring24·center·grid) | `[BORDER=0.2] diag.ts <모드> <파일 목록 json> <출력 이름> [ms]` |
| `horizon.ts` · `cmpH.ts` | 시각·장소·지평선 풀이, blind 답과 비교 | `horizon.ts <pass1 json>` (web 폴더 전용) |
| `rankStats.ts` · `summarize.ts` | 밝은 별 순위 통계, 보고서 표 | 인자 없음 (web 폴더 전용) |

**별하늘지기 카페 사진은 브라우저 안전 제한으로 못 받았다** — 사용자가 `public/samples-external/cafe-2026-10/`에 넣으면 같은 스크립트로 돌릴 수 있다:

```sh
S=/private/tmp/claude-504/-Users-ybbarng-personal-projects-star-byb-kr/0b1a2036-9418-4591-b809-960b2f90cd84/scratchpad/validate
node_modules/.bin/tsx --tsconfig tsconfig.json $S/detectAll.ts cafe-2026-10 0/1
node_modules/.bin/tsx --tsconfig tsconfig.json $S/run.ts cafe-2026-10 8000 cafe-pass1
NOBOX=1 node_modules/.bin/tsx --tsconfig tsconfig.json $S/overlay.ts cafe-2026-10 $S/out/cafe-pass1-0.json solved
```

결과는 `$S/out/cafe-pass1-0.json`(사진마다 확신 여부·시간·시야각·겹친 별), 그림은 `$S/img/`. 출처표가 없으면 분류 집계(`summarize.ts`)와 시각·장소 풀이는 건너뛴다.
