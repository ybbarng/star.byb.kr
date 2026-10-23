# 처음 보는 인터넷 사진 200장으로 검증 (2026-10)

Plate Solver를 처음 보는 인터넷 사진 200장에 돌리고, 맞았는지 따로 판정하고, 못 푼 원인을 나눴다.
**이 사진들로 알고리즘 값을 하나도 바꾸지 않았다** (src/ 코드는 그대로, 측정 스크립트는 세션 임시 폴더에만 두었다).

> **200장 기준으로 다시 썼다** (2026-10-23). 처음 100장(web-001~100)에 어안 9장을 다시 넣고, 그때 대신 받은 9장(101~109)을 그대로 두고,
> 조건을 넓혀 91장(110~200)을 새로 받았다. 새 91장에는 달·박명·별 궤적·망원·휴대폰 느낌 사진 등 처음 100장에 없던 조건을 일부러 넣었다.
> 그래서 처음 100장보다 어려운 사진이 많고, 확신 비율이 처음 보고서(커밋 977c28b, 3d5d611)보다 낮다.

## 1. 요약

| | 8초 (앱과 같은 조건) | 60초 (진단용) |
|---|---|---|
| 확신 | **102 / 200** | 110 / 200 |
| 그중 겹친 별 기준으로 정답 | 101 | 106 |
| 그중 애매 (눈으로는 맞음) | 1 (071) | 2 (071·075) |
| 틀린 답을 확신 | **0** | 2 (104·158) |
| 모름 (후보만) | 98 | 90 |

- **앱과 같은 8초 조건에서 틀린 확신은 200장 중 한 장도 없었다.** 확신한 102장은 모두 눈으로 봐도 별자리가 사진 별 위에 맞게 놓였다 (3.3절).
- 60초 진단에서는 숫자로 틀린 확신이 두 장 나왔다. 104(붉은 오로라)는 변환이 크게 일그러진 진짜 오답이고, 158(달빛 아래 짧은 별 궤적)은 숫자로는 오답이지만 눈으로는 맞아 보인다 (검출 대부분이 풀밭이라 겹친 별 지표가 낮다).
- 확신한 사진의 풀이 시간은 중앙값 0.09초, 102장 중 76장이 1초 안. 가장 오래 걸린 건 8.0초(027).
- 못 푼 98장 중 91장은 8초를 다 썼지만, 60초를 줘도 8장만 더 풀렸고(그중 2장은 숫자로 오답) 나머지 90장은 60초 전에(6.5~53.5초) 모든 단계를 다 보고도 못 찾았다 → 대부분 "시간이 모자라서"가 아니라 "못 찾는 것"이다.
- 분류별로 갈린다: 별밭 8/8, 희미한 사진 7/8, 별자리 24/32, 구름 10/15는 잘 풀리고, **별 궤적 0/10, 박명 1/10, 어안 2/12**는 거의 못 푼다. 은하수는 21/51로 여전히 약하다.
- 못 푼 원인: 지상 불빛·구름·박명·달 23장, 원인 미확정(대개 은하수 광각) 23장, 어안·초광각·파노라마 16장, 별 궤적 11장, 광각 가장자리 11장, 8초 부족 6장, 밝은 별이 별다움에서 밀림 6장, 별 적음·좁은 시야 2장.
- 눈에 띄는 것: 휴대폰 느낌의 잡음 많은 사진 두 장(198·199), 시야 11°·14°의 좁은 사진(149 카시오페이아, 144 플레이아데스), 한국 안동 사찰 박명 사진(178)이 8초 안에 풀렸다.

## 2. 사진과 조건

- **사진**: Wikimedia Commons에서 고른 밤하늘 사진 200장 (`public/samples-external/web-2026-10/`의 `web-001.jpg`~`web-200.jpg`, gitignore 대상이라 저장소에 없다).
  가로 1,920px 썸네일이라(세로 사진은 세로가 더 길고, 원본이 1,920px보다 작으면 원본) EXIF는 일부에만 남았다. 출처표 `sources.csv`에 출처 URL·작성자·라이선스·분류(class)·촬영 시각·일부 GPS가 있다.
- **분류** (`sources.csv` class의 첫 단어): 은하수 51, 별자리 32, 오로라 24, 도시 불빛 17, 구름 15, 어안 12, 별 궤적 10, 박명 10, 별밭 8, 희미한 사진 8, 달 7, 망원 5, 번개구름 1.
- **처음 100장 + 101~109**: 처음 수집 때 고른 100장(어안 9장 포함)과, 어안을 뺐을 때 대신 받은 9장. 어안 9장(009·013·021·031·032·033·034·035·087)은 잠시 `web-2026-10-excluded-fisheye/`로 옮겼다가 같은 번호로 되돌렸다.
- **새 91장(110~200)**: 조건을 넓혀 Commons 분류·검색에서 후보 458장을 모으고 축소 모음 그림으로 보고 골랐다.
  - 후보 출처: 나라별 밤하늘·오로라(노르웨이·아이슬란드·핀란드·스웨덴·캐나다·미국·독일·뉴질랜드·호주), 별 궤적(나라별·북극 둘레), 박명(항해·천문 박명, 박명 속 달·금성), 화성·토성이 보이는 밤하늘, 물에 비친 오로라, 구름과 밤하늘, 검색(남십자·전갈·카시오페이아·오리온, 어안·전천, 광해, 눈, 달과 별, 휴대폰, 한국).
  - 구성: 은하수 15, 오로라 10, 별자리 10, 별 궤적 10, 박명 10, 어안·전천 7, 달 7, 도시 불빛 7, 망원(좁은 시야, 망원경 사진 아님) 5, 구름 4, 별밭 3, 희미함(휴대폰 느낌 포함) 3.
    남반구(남십자·마젤란은하·호주·뉴질랜드·칠레·나미비아·볼리비아)와 북반구, 겨울(눈·오리온)과 여름(은하수 중심)이 섞였다.
  - **한국 사진 4장**: 120(은하수), 160(태기산 별 궤적), 161(정혜사지 석탑 별 궤적), 178(안동 사찰 박명).
  - 뺀 것: 딥스카이·망원경 사진(성운·은하 확대), 그림·지도·도표, 이어 붙인 파노라마, 별자리 선을 그려 넣은 사진, 작은 사진을 끼워 넣은 합성(처음 고른 Lailai 광해 사진을 이 때문에 다른 사진으로 바꿨다, 지금 191).
  - 기존 109장과 같은 파일이 없고, 같은 촬영자는 기존 포함 2장을 넘지 않는다 (내려받기 스크립트가 확인).
  - 휴대폰 사진이라는 표시가 없어 "휴대폰 느낌"(4:3·12~13MP 세로 사진, 잡음)으로만 적었다 (179·185·198·199).
- **풀이**: 앱과 똑같은 흐름. `detectLikeApp`(src/test/real/detectImage.ts) → `buildSolverContext` → `solvePhoto` 기본값(시간 상한 8초). 외부 사진 테스트(`externalSamples.test.ts`)와 같은 방식이다.
- **기계**: Apple M3 Pro, node v20.11.0, 사진을 한 장씩 차례로. 8초 측정과 재시도는 다른 작업 없이 혼자 돌렸고 `caffeinate`로 잠들기를 막았다.
  - 처음 측정 때 사고 하나: 재시도 중 노트북이 잠들어 두 장(058·074)이 900초대로 찍혔다(`pmset` 로그로 확인). 두 장을 다시 쟀다 (둘 다 8.9초, 결과 같음).
- 확신 못 한 98장은 8초로 한 번 더 쟀다 (기계 부하 탓 배제). 98장 모두 같은 결과였다.
- 진단용 60초 측정은 처음 91장 몫과 새 91장 몫을 각각 4개 프로세스로 나란히 돌렸다 (시간은 혼자 돌릴 때보다 조금 부풀었을 수 있다). 101~109 몫(3장)은 혼자 돌렸다.
- 새 91장의 진단 실험(6.1절)은 다섯 가지를 나란히 돌렸다.

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
- 인터넷 사진에서 8초로 확신한 102장 중 74장이 61~150위 꼬리 ≥ 3, 59장이 ≥ 5였다 (오답 최대 3.2를 넘는다).

### 3.3 눈으로 확인

확신한 사진마다 별자리 선과 밝은 별 이름(2.6등급까지)을 사진 위에 그려 여러 장씩 묶어 보았다(scratchpad, 저장소에 넣지 않음).
8초로 확신한 102장과 60초에서 더 풀린 6장(075·078·092·128·173·192)은 모두 **맞음**: 북두칠성·카시오페이아·오리온·여름 대삼각형·백조·남십자·전갈·궁수 주전자 등이 사진 속 별 배치와 맞고,
은하수 중심이 궁수·전갈 사이에, 플레이아데스가 성단 위에 놓였다. 008은 달·금성이 플레이아데스 근처(2023-04-23의 실제 배치),
010은 달이 쌍둥이자리 옆(2023-03-30)으로 촬영 날짜와도 맞았다. 새 사진에서는 136·137·138(남십자·알파/베타 센타우리), 146(오리온, 시야 18°),
149(카시오페이아 W, 시야 11°), 195(구름 사이 오리온·시리우스)가 한눈에 맞다.
**60초에서 확신한 104는 틀림**: 변환이 크게 일그러져 하늘 전체가 오른쪽 위 구석에 몰리고, 화면 대부분에 별자리 선이 길게 늘어진다. 숫자 판정(꼬리 1.7, 오답)과 눈 판정이 같다.

**숫자 기준과 눈 판정이 엇갈리거나 약한 사진**

| 사진 | 숫자 | 눈 | 이유 |
|---|---|---|---|
| 071 | 애매 (m 19, e 3.1, 꼬리 9.1) | 맞음 | 궁수 주전자·전갈 꼬리가 은하수 중심 옆에 정확히 놓인다. 상위 검출 대부분이 5등급보다 어두운 은하수 별이라 m이 낮다 |
| 075 (60초) | 애매 (꼬리 10.1) | 맞음(하늘 쪽) | 하늘 쪽은 맞는데 호수 반사(거울상)가 검출의 절반이라 겹친 별이 덜 나온다 |
| 158 (60초) | 오답 (m 9, e 2.2, 꼬리 3.4) | 맞아 보임 | 짧은 별 궤적의 끝에 아케르나르·안카아·포말하우트가 놓인다. 검출 상위 대부분이 달빛 받은 풀밭이라 겹친 별이 적다. 61~150위 꼬리는 8.5로 오답 최대(3.2)보다 높다 |
| 041·064 | 정답 (꼬리 14.2·17.3) | 맞음(약함) | 별 궤적·어두운 사진이라 별자리 모양을 눈으로 알아보긴 어렵지만, 하늘 쪽 투영 별이 검출 표시와 하나하나 겹친다 |
| 140 | 정답 (꼬리 12.8, 기준 바로 위) | 맞음(약함) | 헤르쿨레스·용 머리가 별 위에 놓이고, 지평선 아래로 투영된 직녀·데네브는 산·마을에 가려진 자리다 |
| 192 (60초) | 정답 (꼬리 16.2) | 맞음(약함) | 거리 불빛 사진이라 별이 희미하다. 61~150위 꼬리는 0.3 |

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
  | 101 | Canon 5D Mark IV, 24mm | 53.1° | 51.3° |
  | 127 | Canon 70D, 12mm | 64.0° | 61.9° |
  | 178 | Canon 5D Mark III, 35mm | 37.8° | 39.3° |

  004·071은 초광각의 왜곡이나 크롭 때문에 몇 도 차이가 난다.
- **시각·장소·지평선 풀이와의 일치**: 055·109·127은 blind 풀이와 시각·장소 풀이가 각각 확신했고 광축이 0.3° 안으로 같았다. 079·096·106·178도 0.1~1.3° 안으로 같았다 (시각·장소 풀이는 확신 못 함, 6장 참고).

## 4. 분류별 결과

분류는 `sources.csv`의 class 첫 단어. "정답·애매·오답"은 3장의 겹친 별 기준(8초 + 60초에서 확신한 것).

| 분류 | 사진 | 8초 확신 | 60초까지 확신 | 정답 | 애매 | 오답 |
|---|---|---|---|---|---|---|
| 은하수 | 51 | 21 (41%) | 25 | 23 | 2 | 0 |
| 별자리 | 32 | 24 (75%) | 24 | 24 | 0 | 0 |
| 오로라 | 24 | 13 (54%) | 14 | 13 | 0 | 1 |
| 도시 불빛 | 17 | 9 (53%) | 10 | 10 | 0 | 0 |
| 구름 | 15 | 10 (67%) | 10 | 10 | 0 | 0 |
| 어안 | 12 | 2 (17%) | 2 | 2 | 0 | 0 |
| 별 궤적 | 10 | 0 (0%) | 1 | 0 | 0 | 1 |
| 박명 | 10 | 1 (10%) | 2 | 2 | 0 | 0 |
| 별밭 | 8 | 8 (100%) | 8 | 8 | 0 | 0 |
| 희미함 | 8 | 7 (88%) | 7 | 7 | 0 | 0 |
| 달 | 7 | 4 (57%) | 4 | 4 | 0 | 0 |
| 망원 | 5 | 3 (60%) | 3 | 3 | 0 | 0 |
| 번개구름 | 1 | 0 (0%) | 0 | 0 | 0 | 0 |
| **합계** | **200** | **102** | **110** | **106** | **2** | **2** |

- 별밭·희미한 사진·별자리·구름(밝은 별이 또렷하고 시야가 보통)은 63장 중 49장. 휴대폰 느낌의 잡음 많은 사진(198·199)도 풀렸다.
- 망원(좁은 시야) 5장 중 3장(144 플레이아데스 14°, 146 오리온 18°, 149 카시오페이아 11°)이 풀렸다. 못 푼 145(오리온 15°)·148(남십자 별밭)은 밝게 번진 별이 별다움에서 밀렸다(D).
- **별 궤적 10장은 8초에 하나도 못 풀었다.** 별이 점이 아니라 선이라 검출이 궤적 위 여러 점으로 쪼개진다. 짧은 궤적인 158만 60초에 확신했는데 숫자로는 오답이다.
- **박명 10장 중 8초에는 178 하나**(60초에 173). 별이 몇 개뿐이고 하늘 밝기 기울기·나뭇가지·첨탑 가장자리가 검출 상위를 차지한다.
- 어안 12장 중 둘(166 전천 느낌의 초광각, 168 텐트 어안)은 직선투영으로 풀렸다. 원형 전천 사진은 하나도 못 풀었다. 어안 blind 풀이는 200장에서 한 번도 채택되지 않았다.
- 은하수 사진이 여전히 약하다(51장 중 21장). 대개 초광각이고, 밝은 은하수 배경 위의 밝은 별이 별다움에서 밀리기 쉽다(6장 C·D·G).
- 오로라의 오답 1은 104의 60초 결과, 별 궤적의 오답 1은 158의 60초 결과다 (둘 다 8초에서는 모름).

**어떤 경로로 풀렸나** (8초 확신 102장, 확신한 단계): 개선 quad·사진 전체 66, 삼각형·사진 전체 30, 삼각형·위쪽 75%/55% 4, 개선 quad·위쪽 75% 2.
확신한 해의 log-odds는 11.0 ~ 96.4 (중앙 34.3), 시야각은 11.0° ~ 73.8°.

## 5. 사진별 결과

- 001~100은 처음 받은 100장(어안 9장 포함), 101~109는 어안을 뺐을 때 대신 받은 9장, 110~200은 새로 받은 91장이다.
- 결과: 8초 결과 → 재시도(8초) → 60초 진단. "1위 후보"는 확신 못 했을 때 가장 믿을 만한 후보의 log-odds.
- 시간: 8초 측정의 풀이 시간(초, 검출 제외). 확신 못 한 사진은 8초 상한 + 마지막 단계 마무리로 대개 8.8~9.2초 (일부는 모든 단계를 더 일찍 마침).
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
| 009 | 오로라/어안 | [Commons](https://commons.wikimedia.org/wiki/File:Aurora_Borealis_in_Cleveland,_Ohio_(53713645409).jpg) | 409 | 모름 (1위 후보 5.0), 재시도 모름, 60초: 18초에 끝, 모름 | 8.85 |  |  |  |  |  | B. 어안: 지평선이 크게 휨 (오로라) |
| 010 | 오로라/달 | [Commons](https://commons.wikimedia.org/wiki/File:Tj%C3%A4ktjus,_Norrbotten_(52806406564).jpg) | 3894 | 확신 | 2.51 | 73.1 | 57.6 | 57/4.8 (40.1) | 정답 / 맞음 | triangle·사진 전체·60 |  |
| 011 | 오로라/달 | [Commons](https://commons.wikimedia.org/wiki/File:Polar_lights_and_moon.jpg) | 1117 | 확신 | 0.06 | 49.4 | 17.2 | 30/4.0 (16.2) | 정답 / 맞음 | improved·사진 전체·25 |  |
| 012 | 오로라/도시광 | [Commons](https://commons.wikimedia.org/wiki/File:Aurora_over_Red_Wing,_Minnesota_(53776610154).jpg) | 1456 | 확신 | 1.46 | 62.0 | 38.7 | 56/5.2 (37.0) | 정답 / 맞음 | triangle·사진 전체·60 |  |
| 013 | 구름/어안 | [Commons](https://commons.wikimedia.org/wiki/File:Big_Dipper_in_Spring_(ann22042c-spring).jpg) | 3669 | 모름 (1위 후보 4.4), 재시도 모름, 60초: 38초에 끝, 모름 | 8.79 |  |  |  |  |  | B. 어안: 지평선이 휨 (구름) |
| 014 | 구름 | [Commons](https://commons.wikimedia.org/wiki/File:Day_157_Photo365_Off_Topic_(111198079).jpeg) | 1355 | 확신 | 1.35 | 63.9 | 36.6 | 54/3.8 (41.8) | 정답 / 맞음 | triangle·사진 전체·25 |  |
| 015 | 구름/은하수/바다 | [Commons](https://commons.wikimedia.org/wiki/File:Milky_Way_over_Mewstone_-_Devon_(36052577316).jpg) | 3255 | 확신 | 7.70 | 73.7 | 27.7 | 53/6.6 (29.0) | 정답 / 맞음 | triangle·위쪽 75%·25 |  |
| 016 | 구름 | [Commons](https://commons.wikimedia.org/wiki/File:Southern_Night_Sky_(32391872002).jpg) | 1866 | 확신 | 0.13 | 62.2 | 34.3 | 56/6.3 (32.7) | 정답 / 맞음 | improved·사진 전체·60 |  |
| 017 | 구름/지상물체 | [Commons](https://commons.wikimedia.org/wiki/File:Milky_way_galaxy,_lake_Tekapo,_stargazing_view_3.jpg) | 3697 | 확신 | 0.09 | 46.6 | 19.0 | 39/4.4 (23.2) | 정답 / 맞음 | improved·사진 전체·40 |  |
| 018 | 구름/산 | [Commons](https://commons.wikimedia.org/wiki/File:Blue_(31352183).jpeg) | 1314 | 모름 (1위 후보 8.6), 재시도 모름, 60초: 13초에 끝, 모름 | 8.93 |  |  |  |  |  | F. 별이 적고 희미함 + 구름 (별다운 검출 337개) |
| 019 | 구름/눈/지상물체 | [Commons](https://commons.wikimedia.org/wiki/File:Small_house_(12774242885).jpg) | 4626 | 확신 | 1.10 | 51.1 | 19.8 | 30/2.5 (21.8) | 정답 / 맞음 | triangle·사진 전체·25 |  |
| 020 | 구름/나무 | [Commons](https://commons.wikimedia.org/wiki/File:Garden_Route_Game_Lodge-2658.jpg) | 1470 | 확신 | 0.09 | 26.0 | 46.2 | 52/2.1 (52.2) | 정답 / 맞음 | improved·사진 전체·40 |  |
| 021 | 구름/어안/사람 | [Commons](https://commons.wikimedia.org/wiki/File:%E6%98%9F%E3%82%84%E9%9B%B2%E4%B8%8B%E3%81%AE%E6%81%8B%E4%BA%BA_(14914970417).jpg) | 4541 | 모름 (1위 후보 4.9), 재시도 모름, 60초: 44초에 끝, 모름 | 8.89 |  |  |  |  |  | B. 어안 (구름·사람) |
| 022 | 도시광/오로라 | [Commons](https://commons.wikimedia.org/wiki/File:GXZBAFFWMAAw8YY.jpg) | 560 | 확신 | 0.09 | 57.3 | 27.1 | 35/2.6 (26.5) | 정답 / 맞음 | improved·사진 전체·40 |  |
| 023 | 도시광/구름 | [Commons](https://commons.wikimedia.org/wiki/File:Lighting,_Stars,_and_Houses_(36962357236).jpg) | 1377 | 확신 | 0.09 | 33.6 | 27.7 | 36/1.6 (35.0) | 정답 / 맞음 | improved·사진 전체·40 |  |
| 024 | 도시광/바다 | [Commons](https://commons.wikimedia.org/wiki/File:R%C3%ADa_de_Vigo_-_Lim%C3%A9ns.jpg) | 945 | 확신 | 0.13 | 45.6 | 25.3 | 44/5.0 (25.9) | 정답 / 맞음 | improved·사진 전체·60 |  |
| 025 | 도시광/은하수 | [Commons](https://commons.wikimedia.org/wiki/File:Holy_City_and_the_night_sky.jpg) | 2865 | 모름 (1위 후보 4.9), 재시도 모름, 60초: 22초에 끝, 모름 | 8.87 |  |  |  |  |  | E. 지상 불빛 (다리·도시 조명이 상위 검출) |
| 026 | 도시광/은하수 | [Commons](https://commons.wikimedia.org/wiki/File:Starry_night_sky.jpg) | 2885 | 모름 (1위 후보 4.0), 재시도 모름, 60초: 20초에 끝, 모름 | 8.87 |  |  |  |  |  | E. 지상 불빛 (호숫가 마을 조명·반사) |
| 027 | 도시광/호수 | [Commons](https://commons.wikimedia.org/wiki/File:Milchstra%C3%9Fe_-_Alpen_-_Neuschwanstein_-_panoramio.jpg) | 3428 | 확신 | 8.04 | 65.0 | 44.7 | 57/5.9 (35.3) | 정답 / 맞음 | triangle·위쪽 55%·25 |  |
| 028 | 도시광/산 | [Commons](https://commons.wikimedia.org/wiki/File:Himalayas_under_moon_light_at_Narkanda.jpg) | 392 | 모름 (1위 후보 5.1), 재시도 모름, 60초: 25초에 끝, 모름 | 8.86 |  |  |  |  |  | E. 달빛 박명, 별 거의 없음, 상위 검출 대부분 마을 불빛 |
| 029 | 도시광/주택 | [Commons](https://commons.wikimedia.org/wiki/File:%E5%8D%97%E3%81%AE%E3%81%B2%E3%81%A8%E3%81%A4%E6%98%9F_-_panoramio.jpg) | 525 | 확신 | 0.02 | 31.6 | 30.0 | 32/1.1 (34.6) | 정답 / 맞음 | improved·사진 전체·15 |  |
| 030 | 도시광/은하수/건물 | [Commons](https://commons.wikimedia.org/wiki/File:Milkway_(8554754431).jpg) | 4573 | 확신 | 0.08 | 45.9 | 55.4 | 58/2.8 (53.5) | 정답 / 맞음 | improved·사진 전체·40 |  |
| 031 | 어안/은하수 | [Commons](https://commons.wikimedia.org/wiki/File:A_milky_arc_over_Paranal_(potw1411a-cc-fd).jpg) | 3945 | 모름 (1위 후보 4.7), 재시도 모름, 60초: 38초에 끝, 모름 | 8.97 |  |  |  |  |  | B. 전천 어안 (원형) |
| 032 | 어안/전천 | [Commons](https://commons.wikimedia.org/wiki/File:A_planetary_party_portrait_above_Paranal_(potw2510a).jpg) | 5025 | 모름 (1위 후보 5.1), 재시도 모름, 60초: 30초에 끝, 모름 | 8.84 |  |  |  |  |  | B. 전천 어안 (원형, 글씨·선 표시) |
| 033 | 어안/전천/은하수 | [Commons](https://commons.wikimedia.org/wiki/File:A_stop_to_enjoy_the_Chilean_sky_(150123-24_atacama_fullfr_cc).jpg) | 4803 | 모름 (1위 후보 5.8), 재시도 모름, 60초: 38초에 끝, 모름 | 8.83 |  |  |  |  |  | B. 전천 어안 (원형, 은하수) |
| 034 | 어안/은하수 | [Commons](https://commons.wikimedia.org/wiki/File:The_Milky_Way_Across_the_Zenith_(ann22042s).jpg) | 5307 | 모름 (1위 후보 5.1), 재시도 모름, 60초: 39초에 끝, 모름 | 8.98 |  |  |  |  |  | B. 전천 어안 (원형) |
| 035 | 어안/은하수/광해 | [Commons](https://commons.wikimedia.org/wiki/File:Milkyway_at_Cape_Leveque.jpg) | 5654 | 모름 (1위 후보 4.8), 재시도 모름, 60초: 30초에 끝, 모름 | 8.82 |  |  |  |  |  | B. 어안 (출처 분류가 어안, 광해) |
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
| 087 | 은하수/사람/광해 | [Commons](https://commons.wikimedia.org/wiki/File:Star_Party_(iau0918a).jpg) | 3302 | 모름 (1위 후보 3.7), 재시도 모름, 60초: 33초에 끝, 모름 | 8.98 |  |  |  |  |  | B. 어안 의심 (지평선이 크게 휨) |
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
| 101 | 별자리/산/숲 | [Commons](https://commons.wikimedia.org/wiki/File:BigDipperGlacierNational.jpg) | 4924 | 확신 | 3.54 | 51.3 | 17.7 | 26/2.5 (17.5) | 정답 / 맞음 | triangle·사진 전체·60 |  |
| 102 | 도시광/마을/눈 | [Commons](https://commons.wikimedia.org/wiki/File:Night_starry_sky.jpg) | 441 | 확신 | 0.12 | 51.7 | 41.5 | 50/3.8 (36.9) | 정답 / 맞음 | improved·사진 전체·40 |  |
| 103 | 오로라/달/숲 | [Commons](https://commons.wikimedia.org/wiki/File:Nordlichter.jpg) | 189 | 모름 (1위 후보 5.5), 재시도 모름, 60초: 21초에 끝, 모름 | 9.07 |  |  |  |  |  | E. 오로라 + 나무 능선·마을 불빛이 상위 검출 (별다운 검출 11개, 달 하나) |
| 104 | 오로라/나무 | [Commons](https://commons.wikimedia.org/wiki/File:Zorza_polarna_w_Polsce,_w_wojew%C3%B3dztwie_%C5%9Bwi%C4%99tokrzyskim,_20240510_2235_8774.jpg) | 1457 | 모름 (1위 후보 5.4), 재시도 모름, 60초: 28.5초에 확신 | 8.94 | 63.1 | 19.1 | 21/12.7 (1.7) | 오답 / 틀림(변환이 크게 일그러져 별자리가 오른쪽 위 구석에 몰림) |  | E. 붉은 오로라·구름 + 나무 능선이 상위 검출 (별다운 검출 58개). 60초에서는 틀린 답을 확신(꼬리 1.7) |
| 105 | 구름/눈/나무 | [Commons](https://commons.wikimedia.org/wiki/File:%D0%92%D0%B5%D1%81%D0%B5%D0%BD%D0%BD%D1%8F%D1%8F_%D1%81%D0%B8%D0%B1%D0%B8%D1%80%D1%81%D0%BA%D0%B0%D1%8F_%D0%BD%D0%BE%D1%87%D1%8C.jpg) | 4415 | 확신 | 2.54 | 73.8 | 46.4 | 68/5.9 (46.7) | 정답 / 맞음 | triangle·사진 전체·25 |  |
| 106 | 구름/은하수/나무 | [Commons](https://commons.wikimedia.org/wiki/File:Stars_(43995564881).jpg) | 5636 | 확신 | 1.47 | 49.3 | 23.3 | 35/3.4 (22.9) | 정답 / 맞음 | triangle·사진 전체·60 |  |
| 107 | 은하수/사막 | [Commons](https://commons.wikimedia.org/wiki/File:Night_sky_in_the_Sahara_-_Morocco.jpg) | 4259 | 모름 (1위 후보 6.2), 재시도 모름, 60초: 8초에 끝, 모름 | 8.42 |  |  |  |  |  | C. 광각 가장자리: 가장자리 20% 빼면 log-odds 9.8 (겹친 별 지표 애매), 칸마다 고르기로는 18.9 확신 (정답). 8초 1위 후보(6.2)가 이미 정답(꼬리 14.0). 가장 밝은 점(목성으로 보임)이 줄지음으로 잘못 묶여 맨 뒤(3,981위)로 밀림 |
| 108 | 은하수/바위/호수 | [Commons](https://commons.wikimedia.org/wiki/File:%D0%97%D0%B2%D0%B5%D0%B7%D0%B4%D0%BD%D0%B0%D1%8F_%D0%BD%D0%BE%D1%87%D1%8C.jpg) | 4573 | 확신 | 0.91 | 53.4 | 18.0 | 36/4.2 (20.9) | 정답 / 맞음 | triangle·사진 전체·25 |  |
| 109 | 은하수/산/초원 | [Commons](https://commons.wikimedia.org/wiki/File:Bonito_Park_(33983035334).jpg) | 2916 | 확신 | 0.03 | 52.5 | 35.4 | 49/3.6 (37.4) | 정답 / 맞음 | improved·사진 전체·15 |  |
| 110 | 오로라/호수 | [Commons](https://commons.wikimedia.org/wiki/File:Auroras_3_-_panoramio.jpg) | 1707 | 확신 | 0.20 | 47.1 | 48.3 | 52/2.2 (51.5) | 정답 / 맞음 | improved·사진 전체·60 |  |
| 111 | 오로라/은하수/남반구 | [Commons](https://commons.wikimedia.org/wiki/File:Aurora_Australis_and_several_Galaxies_(53476861664).jpg) | 5775 | 모름 (1위 후보 4.4), 재시도 모름, 60초: 22초에 끝, 모름 | 8.96 |  |  |  |  |  | G. 원인 미확정: 오로라 + 은하수 광각 (마젤란은하) |
| 112 | 오로라/달/산 | [Commons](https://commons.wikimedia.org/wiki/File:Aurora_at_Moonset.jpg) | 1970 | 모름 (1위 후보 4.5), 재시도 모름, 60초: 45초에 끝, 모름 | 9.01 |  |  |  |  |  | C. 광각 가장자리: 가장자리 12% 빼면 확신 (시야 62°, 꼬리 12.4로 애매) |
| 113 | 오로라/눈 | [Commons](https://commons.wikimedia.org/wiki/File:Aurora_ad_Inari_-_2.jpg) | 1667 | 모름 (1위 후보 3.6), 재시도 모름, 60초: 32초에 끝, 모름 | 8.99 |  |  |  |  |  | C. 광각 가장자리: 가장자리 20% 빼면 확신 (시야 67°, 꼬리 10.6으로 애매) |
| 114 | 오로라/구름 | [Commons](https://commons.wikimedia.org/wiki/File:Polarlichter_16._April_2025_(Sony_NEX6,_Full_Spectrum)_-_DSC09505_(54459764104).jpg) | 1285 | 확신 | 0.05 | 38.5 | 26.1 | 44/3.3 (33.1) | 정답 / 맞음 | improved·사진 전체·25 |  |
| 115 | 오로라/구름 | [Commons](https://commons.wikimedia.org/wiki/File:Aurora_borealis_II_(15592051755).jpg) | 449 | 확신 | 0.03 | 44.5 | 46.6 | 62/3.5 (53.2) | 정답 / 맞음 | improved·사진 전체·15 |  |
| 116 | 오로라/사람 | [Commons](https://commons.wikimedia.org/wiki/File:Aurora_borealis_(14832459401).jpg) | 2448 | 확신 | 0.06 | 50.8 | 24.0 | 39/3.7 (25.9) | 정답 / 맞음 | improved·사진 전체·25 |  |
| 117 | 오로라/산/바다 | [Commons](https://commons.wikimedia.org/wiki/File:Aurora_borealis_above_Lyngenfjorden,_2012_March.jpg) | 1055 | 모름 (1위 후보 4.2), 재시도 모름, 60초: 27초에 끝, 모름 | 8.89 |  |  |  |  |  | C. 광각 가장자리: 가장자리 20% 빼면 확신 (시야 53°, 꼬리 13.4) |
| 118 | 오로라/호수반사/나무 | [Commons](https://commons.wikimedia.org/wiki/File:Gaddtrask.jpg) | 2212 | 모름 (1위 후보 8.2), 재시도 모름, 60초: 26초에 끝, 모름 | 8.93 |  |  |  |  |  | G. 원인 미확정: 오로라 + 나무·호수 반사. 8초 1위 후보(log-odds 8.2)가 이미 정답(꼬리 15.5)이지만 60초로도 확신 못 함 |
| 119 | 오로라/산/호수 | [Commons](https://commons.wikimedia.org/wiki/File:Northern_Lights_Over_the_Tetons_-_5_(53487741474).jpg) | 3483 | 모름 (1위 후보 4.2), 재시도 모름, 60초: 28초에 끝, 모름 | 8.87 |  |  |  |  |  | G. 원인 미확정: 오로라 + 산·눈 호수 |
| 120 | 은하수/한국 | [Commons](https://commons.wikimedia.org/wiki/File:%EB%B0%A4%ED%95%98%EB%8A%98%EC%9D%98_%EC%9D%80%ED%95%98%EC%88%98.jpg) | 6186 | 모름 (1위 후보 4.3), 재시도 모름, 60초: 22초에 끝, 모름 | 8.90 |  |  |  |  |  | G. 원인 미확정: 은하수 광각 (한국), 검출 6,186개 |
| 121 | 은하수/숲 | [Commons](https://commons.wikimedia.org/wiki/File:Night_sky_as_seen_from_Auvergne,_France,_2021-07-12_Canon_EOS_6D_Mark_II_(flickr_51320561610).jpg) | 4558 | 확신 | 1.46 | 73.8 | 15.7 | 39/6.2 (18.0) | 정답 / 맞음 | triangle·사진 전체·60 |  |
| 122 | 은하수/산/텐트 | [Commons](https://commons.wikimedia.org/wiki/File:Alpy,_Aosta,_It%C3%A1lie,_%C5%A0v%C3%BDcarsko,_imgp5462-imgp5444_(2016-08).jpg) | 5025 | 모름 (1위 후보 4.3), 재시도 모름, 60초: 22초에 끝, 모름 | 8.91 |  |  |  |  |  | G. 원인 미확정: 은하수 + 산·텐트, 밝은 행성이 상위에 없음 (별다움을 지워도 안 풀림) |
| 123 | 은하수/산/초광각 | [Commons](https://commons.wikimedia.org/wiki/File:The_Pillar_of_Creation_(ann22042d).jpg) | 5221 | 모름 (1위 후보 5.3), 재시도 모름, 60초: 26초에 끝, 모름 | 8.87 |  |  |  |  |  | G. 원인 미확정: 은하수 초광각 (트레 치메), 박명 빛 |
| 124 | 은하수/바위아치/남반구 | [Commons](https://commons.wikimedia.org/wiki/File:Rock_Arch_At_Night_(224612485).jpeg) | 3779 | 모름 (1위 후보 4.4), 재시도 모름, 60초: 23초에 끝, 모름 | 8.94 |  |  |  |  |  | G. 원인 미확정: 바위 아치가 하늘 절반을 가림 |
| 125 | 은하수/건초더미 | [Commons](https://commons.wikimedia.org/wiki/File:Brion_(43121747344).jpg) | 6073 | 모름 (1위 후보 5.1), 재시도 모름, 60초: 39초에 끝, 모름 | 8.89 |  |  |  |  |  | G. 원인 미확정: 세로 은하수 + 건초더미·차 불빛 |
| 126 | 은하수/기차역 | [Commons](https://commons.wikimedia.org/wiki/File:Estaci%C3%B3n_de_Agram%C3%B3n_-_v%C3%ADa_l%C3%A1ctea.jpg) | 5311 | 모름 (1위 후보 4.0), 재시도 모름, 60초: 37초에 끝, 모름 | 9.07 |  |  |  |  |  | G. 원인 미확정: 은하수 광각 (1위 후보 시야 72°) |
| 127 | 은하수/바위/물반사 | [Commons](https://commons.wikimedia.org/wiki/File:Daguoye_Columnar_Basalt_under_night_starry_sky.jpg) | 2656 | 확신 | 0.10 | 61.9 | 43.1 | 63/5.3 (43.9) | 정답 / 맞음 | improved·사진 전체·40 |  |
| 128 | 은하수/등대 | [Commons](https://commons.wikimedia.org/wiki/File:%E5%A2%BE%E4%B8%81%E5%9C%8B%E5%AE%B6%E5%85%AC%E5%9C%92-%E9%B5%9D%E9%91%BE%E9%BC%BB%E7%87%88%E5%A1%94%E9%8A%80%E6%B2%B3.jpg) | 3710 | 모름 (1위 후보 4.9), 재시도 모름, 60초: 31.6초에 확신 | 8.93 | 60.5 | 38.3 | 46/4.2 (31.0) | 정답 / 맞음 |  | A. 8초 부족 (60초 상한에서 31.6초에 확신, 위쪽 45% 영역) |
| 129 | 은하수/산 | [Commons](https://commons.wikimedia.org/wiki/File:Ka%C3%A7kar_Mountains_Night_Sky_View.jpg) | 3350 | 확신 | 6.24 | 35.3 | 12.9 | 25/2.3 (17.0) | 정답 / 맞음 | triangle·사진 전체·60 |  |
| 130 | 은하수/금성/남반구 | [Commons](https://commons.wikimedia.org/wiki/File:Milky_Way_panorama_and_Venus_-_New_South_Wales_-_Australia_-_26_Oct._2013.jpg) | 3222 | 모름 (1위 후보 4.3), 재시도 모름, 60초: 50초에 끝, 모름 | 9.24 |  |  |  |  |  | G. 원인 미확정: 은하수 + 금성, 산불 빛 |
| 131 | 은하수/호수반사 | [Commons](https://commons.wikimedia.org/wiki/File:Milky-way-galaxy-mountain-sky-lake-reflection_-_West_Virginia_-_ForestWander.jpg) | 1731 | 확신 | 0.99 | 48.6 | 40.4 | 56/3.6 (45.6) | 정답 / 맞음 | triangle·사진 전체·25 |  |
| 132 | 은하수/바위 | [Commons](https://commons.wikimedia.org/wiki/File:Milky_Way_Joshua_Tree_(220895735).jpeg) | 4023 | 모름 (1위 후보 4.3), 재시도 모름, 60초: 20초에 끝, 모름 | 8.88 |  |  |  |  |  | G. 원인 미확정: 은하수 + 바위 |
| 133 | 은하수/바위/남반구 | [Commons](https://commons.wikimedia.org/wiki/File:Milky_way_seen_from_bolivian_high_altiplano_03.jpg) | 4731 | 확신 | 1.48 | 63.1 | 37.7 | 63/5.5 (43.2) | 정답 / 맞음 | triangle·사진 전체·25 |  |
| 134 | 은하수/배/흑백 | [Commons](https://commons.wikimedia.org/wiki/File:Sailing_the_Celestial_Seas_(ann23043z).jpg) | 3338 | 확신 | 1.41 | 50.2 | 32.3 | 49/3.6 (37.2) | 정답 / 맞음 | triangle·사진 전체·25 |  |
| 135 | 별자리/건물 | [Commons](https://commons.wikimedia.org/wiki/File:Wide-field_image_of_the_sky_in_Pyr%C3%A9n%C3%A9es.jpg) | 2974 | 확신 | 0.02 | 25.0 | 19.0 | 23/0.8 (25.0) | 정답 / 맞음 | improved·사진 전체·15 |  |
| 136 | 별자리/남십자/도시광 | [Commons](https://commons.wikimedia.org/wiki/File:Southern_Cross_from_Queenstown,_NZ_-_panoramio.jpg) | 6785 | 확신 | 0.05 | 49.5 | 86.9 | 91/4.3 (84.5) | 정답 / 맞음 | improved·사진 전체·25 |  |
| 137 | 별자리/남십자 | [Commons](https://commons.wikimedia.org/wiki/File:Beneath_the_Southern_Cross.jpg) | 413 | 확신 | 0.05 | 32.3 | 44.8 | 55/2.7 (50.5) | 정답 / 맞음 | improved·사진 전체·25 |  |
| 138 | 별자리/남십자/나무 | [Commons](https://commons.wikimedia.org/wiki/File:Southern_Cross_(159801645).jpeg) | 2983 | 확신 | 0.09 | 44.1 | 54.4 | 61/3.8 (50.0) | 정답 / 맞음 | improved·사진 전체·40 |  |
| 139 | 별자리/나무 | [Commons](https://commons.wikimedia.org/wiki/File:Geminid_Shoot_Satellites_(51759568907).jpg) | 1526 | 모름 (1위 후보 5.0), 재시도 모름, 60초: 53초에 끝, 모름 | 8.86 |  |  |  |  |  | C. 광각 가장자리: 가장자리 20% 빼면 확신 (시야 80°로 후보 상한 근처, 꼬리 13.0), 박명 |
| 140 | 별자리/설산/달빛 | [Commons](https://commons.wikimedia.org/wiki/File:Everest_Range_Above_Tengboche_at_Night.jpg) | 4870 | 확신 | 0.06 | 44.3 | 12.6 | 22/2.7 (12.8) | 정답 / 맞음(약함, 헤르쿨레스·용 머리가 별 위에 놓이고 직녀·데네브는 산·마을 쪽으로 투영됨) | improved·사진 전체·25 |  |
| 141 | 별자리/설산 | [Commons](https://commons.wikimedia.org/wiki/File:Annapurna_at_Night.jpg) | 5839 | 모름 (1위 후보 6.7), 재시도 모름, 60초: 28초에 끝, 모름 | 8.91 |  |  |  |  |  | D. 밝은 점(행성으로 보임)이 별다움에서 밀림: 별다움 기준을 늦추면 확신 (꼬리 8.3으로 애매) |
| 142 | 별자리/집 | [Commons](https://commons.wikimedia.org/wiki/File:Starlight_Ii_(85196707).jpeg) | 4251 | 모름 (1위 후보 4.4), 재시도 모름, 60초: 25초에 끝, 모름 | 8.98 |  |  |  |  |  | C. 광각 가장자리: 가장자리 20% 빼면 확신 (시야 74°, 꼬리 18.5), 칸마다 고르기로도 확신 (꼬리 26.2) |
| 143 | 별자리/눈/오두막 | [Commons](https://commons.wikimedia.org/wiki/File:Winter_cottage_at_night_at_Pokljuka.jpg) | 3853 | 모름 (1위 후보 5.1), 재시도 모름, 60초: 27초에 끝, 모름 | 8.89 |  |  |  |  |  | G. 원인 미확정: 눈 덮인 오두막, 맑은 별밭 |
| 144 | 별자리/플레이아데스/행성 | [Commons](https://commons.wikimedia.org/wiki/File:Alineaci%C3%B3n_de_las_Pl%C3%A9yades_con_J%C3%BApiter_y_Venus.jpg) | 2076 | 확신 | 0.03 | 13.6 | 27.1 | 25/0.8 (28.6) | 정답 / 맞음(플레이아데스·히아데스 자리에 성단이 있고 밝은 두 점은 행성) | improved·사진 전체·15 |  |
| 145 | 망원/오리온 | [Commons](https://commons.wikimedia.org/wiki/File:Orion_from_GNTO_-_Flickr_-_HypatiaPhoto.jpg) | 8382 | 모름 (1위 후보 8.5), 재시도 모름, 60초: 41초에 끝, 모름 | 9.13 |  |  |  |  |  | D. 좁은 시야(15°) 오리온 + 밝은 별이 별다움에서 밀림: 별다움을 지우면 확신 (꼬리 12.5). 8초 1위 후보(8.5)가 이미 같은 답 |
| 146 | 망원/오리온 | [Commons](https://commons.wikimedia.org/wiki/File:20180211_Orion,_Hauptsterne_(02259).jpg) | 1256 | 확신 | 0.04 | 18.4 | 43.5 | 39/1.1 (45.9) | 정답 / 맞음 | improved·사진 전체·15 |  |
| 147 | 망원/전갈/은하수 | [Commons](https://commons.wikimedia.org/wiki/File:Scorpius_-_Flickr_-_cafuego.jpg) | 8227 | 확신 | 0.04 | 26.1 | 28.6 | 30/1.7 (26.1) | 정답 / 맞음 | improved·사진 전체·15 |  |
| 148 | 망원/남십자 | [Commons](https://commons.wikimedia.org/wiki/File:Southern_Cross_-New_Zealand-.jpg) | 6656 | 모름 (1위 후보 3.8), 재시도 모름, 60초: 33초에 끝, 모름 | 8.90 |  |  |  |  |  | D. 좁은 시야 남십자 별밭: 밝게 번진 별이 상위에 없음. 별다움을 지우면 시야 8.7°의 틀린 답을 확신 (꼬리 2.6) |
| 149 | 망원/카시오페이아 | [Commons](https://commons.wikimedia.org/wiki/File:Cassiopeia_Dsc00982_(2626650190).jpg) | 887 | 확신 | 0.03 | 11.0 | 14.6 | 15/0.4 (18.8) | 정답 / 맞음 | improved·사진 전체·15 |  |
| 150 | 별밭/은하수 | [Commons](https://commons.wikimedia.org/wiki/File:Night_Sky_-_Corner_Brook,_Newfoundland_2019-08-20_(04).jpg) | 2695 | 확신 | 0.09 | 49.1 | 90.8 | 86/3.2 (88.2) | 정답 / 맞음 | improved·사진 전체·40 |  |
| 151 | 별밭/나무 | [Commons](https://commons.wikimedia.org/wiki/File:Nuit_%C3%A9toil%C3%A9e_en_for%C3%AAt_de_Rambouillet_%E2%80%94_06.jpg) | 3912 | 확신 | 0.05 | 42.3 | 60.7 | 66/2.5 (67.6) | 정답 / 맞음 | improved·사진 전체·25 |  |
| 152 | 별밭/나무 | [Commons](https://commons.wikimedia.org/wiki/File:Eucalyptus_tree_with_stars_north_canberra.jpg) | 3593 | 확신 | 0.03 | 22.3 | 24.4 | 28/1.2 (27.9) | 정답 / 맞음 | improved·사진 전체·15 |  |
| 153 | 별궤적/오로라 | [Commons](https://commons.wikimedia.org/wiki/File:Northern_lights_%26_star_trails_(15308185229).jpg) | 7709 | 모름 (1위 후보 5.6), 재시도 모름, 60초: 38초에 끝, 모름 | 8.92 |  |  |  |  |  | H. 별 궤적 (북극 둘레 원호) + 오로라 |
| 154 | 별궤적/탑 | [Commons](https://commons.wikimedia.org/wiki/File:2016-04_Tour_de_la_Miotte_circumpolar_08.jpg) | 2955 | 모름 (1위 후보 5.3), 재시도 모름, 60초: 43초에 끝, 모름 | 8.95 |  |  |  |  |  | H. 별 궤적 (탑, 시야 77°) |
| 155 | 별궤적/나무 | [Commons](https://commons.wikimedia.org/wiki/File:%22Geminid_Spiral%22_(8271392943).jpg) | 3933 | 모름 (1위 후보 3.9), 재시도 모름, 60초: 20초에 끝, 모름 | 9.04 |  |  |  |  |  | H. 별 궤적 (나무) |
| 156 | 별궤적/북극성 | [Commons](https://commons.wikimedia.org/wiki/File:Star_Trails_(53173766455).jpg) | 316 | 모름 (1위 후보 6.2), 재시도 모름, 60초: 18초에 끝, 모름 | 8.87 |  |  |  |  |  | H. 별 궤적 (북극 둘레 원, 별다운 검출 4개) |
| 157 | 별궤적/교회 | [Commons](https://commons.wikimedia.org/wiki/File:Chiesa_del_Santissimo_Rosario.jpg) | 1183 | 모름 (1위 후보 4.1), 재시도 모름, 60초: 21초에 끝, 모름 | 8.96 |  |  |  |  |  | H. 별 궤적 (교회 벽이 상위 검출) |
| 158 | 별궤적/짧은궤적/달빛 | [Commons](https://commons.wikimedia.org/wiki/File:Moonlit_paddocks_and_some_star_trails_in_the_night_sky_(29063193695).jpg) | 2727 | 모름 (1위 후보 4.9), 재시도 모름, 60초: 18.0초에 확신 | 8.86 | 49.9 | 14.5 | 9/2.2 (3.4) | 오답 / 맞아 보임(짧은 별 궤적 끝에 아케르나르·안카아가 놓임) — 검출 대부분이 풀밭이라 겹친 별 지표가 낮음 |  | E. 달빛에 짧은 별 궤적, 상위 검출 대부분이 풀밭 (별다운 검출 116개). 60초에서 확신했지만 꼬리 3.4로 숫자는 오답 (눈으로는 궤적 끝에 투영 별이 놓임) |
| 159 | 별궤적/바위 | [Commons](https://commons.wikimedia.org/wiki/File:Cyclops_Rock_Star_Trails_(49014431327).jpg) | 4330 | 모름 (1위 후보 5.0), 재시도 모름, 60초: 25초에 끝, 모름 | 8.94 |  |  |  |  |  | H. 별 궤적 (긴 궤적, 별다운 검출 24개) |
| 160 | 별궤적/한국/자동차 | [Commons](https://commons.wikimedia.org/wiki/File:%ED%83%9C%EA%B8%B0%EC%82%B0_%EB%B3%84_%EC%9D%BC%EC%A3%BC.jpg) | 4860 | 모름 (1위 후보 4.6), 재시도 모름, 60초: 39초에 끝, 모름 | 8.97 |  |  |  |  |  | H. 별 궤적 (태기산, 자동차·풍력 발전기 불빛) |
| 161 | 별궤적/한국/석탑 | [Commons](https://commons.wikimedia.org/wiki/File:Thirteen_stories_stone_pagoda_in_Jeonghyesaji_and_star_trails.jpg) | 3375 | 모름 (1위 후보 4.0), 재시도 모름, 60초: 24초에 끝, 모름 | 8.99 |  |  |  |  |  | H. 별 궤적 (정혜사지 석탑) |
| 162 | 별궤적/어안/천문대 | [Commons](https://commons.wikimedia.org/wiki/File:Byron_Bay_Observatory_Timelapse.jpg) | 4483 | 모름 (1위 후보 4.4), 재시도 모름, 60초: 31초에 끝, 모름 | 8.90 |  |  |  |  |  | H. 별 궤적 + 어안 (천문대 돔) |
| 163 | 어안/전천 | [Commons](https://commons.wikimedia.org/wiki/File:Atacama_airglow_(babak-2666pano-a).jpg) | 4068 | 모름 (1위 후보 5.0), 재시도 모름, 60초: 33초에 끝, 모름 | 8.85 |  |  |  |  |  | B. 전천 어안 (원형, 손 그림자) |
| 164 | 어안/다리 | [Commons](https://commons.wikimedia.org/wiki/File:Kiso_bridge_-_%E6%9C%A8%E6%9B%BD%E5%A4%A7%E6%A9%8B_m-8_-_panoramio.jpg) | 1883 | 모름 (1위 후보 4.3), 재시도 모름, 60초: 31초에 끝, 모름 | 9.09 |  |  |  |  |  | B. 어안 (다리가 크게 휨) |
| 165 | 어안/전천 | [Commons](https://commons.wikimedia.org/wiki/File:Starry_Horizon_from_Kitt_Peak.jpg) | 4852 | 모름 (1위 후보 6.2), 재시도 모름, 60초: 34초에 끝, 모름 | 8.98 |  |  |  |  |  | B. 전천 어안 (원형, 은하수) |
| 166 | 어안/전천/황도광 | [Commons](https://commons.wikimedia.org/wiki/File:Winter_Constellations_and_Zodiacal_light_-_Flickr_-_Computer_Science_Geek.jpg) | 1227 | 확신 | 0.12 | 70.5 | 11.0 | 37/7.2 (14.6) | 정답 / 맞음 | improved·사진 전체·40 |  |
| 167 | 어안/나무 | [Commons](https://commons.wikimedia.org/wiki/File:Monegrillo_(Explore!)_(9484523575).jpg) | 3744 | 모름 (1위 후보 5.5), 재시도 모름, 60초: 21초에 끝, 모름 | 9.06 |  |  |  |  |  | B. 어안 (지평선·나무가 휨) |
| 168 | 어안/텐트/나무 | [Commons](https://commons.wikimedia.org/wiki/File:Night_at_Dows_Camp.jpg) | 3665 | 확신 | 0.10 | 49.3 | 12.9 | 28/3.8 (14.9) | 정답 / 맞음 | improved·사진 전체·40 |  |
| 169 | 어안/눈숲/올려다봄 | [Commons](https://commons.wikimedia.org/wiki/File:Snow_Covered_Trees_Starry_Night_(166032201).jpeg) | 3539 | 모름 (1위 후보 4.2), 재시도 모름, 60초: 24초에 끝, 모름 | 8.88 |  |  |  |  |  | B. 어안으로 숲에서 하늘을 올려다봄 (나무가 사방으로 뻗음) |
| 170 | 박명/초승달/첨탑 | [Commons](https://commons.wikimedia.org/wiki/File:Kirchmond_-_Church_Moon_-_explored_27-7-2022_-_Flickr_-_greenoid.jpg) | 443 | 모름 (1위 후보 3.7), 재시도 모름, 60초: 7초에 끝, 모름 | 6.71 |  |  |  |  |  | E. 박명 (초승달·첨탑), 별다운 검출 6개 |
| 171 | 박명/초승달/나무 | [Commons](https://commons.wikimedia.org/wiki/File:Attracted_(4082601452).jpg) | 1618 | 모름 (1위 후보 5.4), 재시도 모름, 60초: 16초에 끝, 모름 | 8.89 |  |  |  |  |  | E. 박명 (초승달·나뭇가지), 상위 검출이 나뭇가지 끝 |
| 172 | 박명/새벽 | [Commons](https://commons.wikimedia.org/wiki/File:Pre-dawn_sky_near_Ottawa_5314.jpg) | 950 | 모름 (1위 후보 4.9), 재시도 모름, 60초: 35초에 끝, 모름 | 8.90 |  |  |  |  |  | E. 새벽 박명, 하늘 밝기 기울기 |
| 173 | 박명/플레이아데스/새벽 | [Commons](https://commons.wikimedia.org/wiki/File:Celebrating_Matariki_-_M%C4%81ori_New_Year_-_Flickr_-_Geoff_J_Mckay.jpg) | 3707 | 모름 (1위 후보 4.8), 재시도 모름, 60초: 12.9초에 확신 | 8.89 | 60.5 | 41.1 | 39/4.2 (23.9) | 정답 / 맞음 |  | A. 8초 부족 (60초 상한에서 12.9초에 확신, 새벽 박명) |
| 174 | 박명/달/행성/주택 | [Commons](https://commons.wikimedia.org/wiki/File:KAR_Mond_und_Planeten_Februar_2023_21ster.jpg) | 1351 | 모름 (1위 후보 4.7), 재시도 모름, 60초: 37초에 끝, 모름 | 8.86 |  |  |  |  |  | E. 박명 + 집 불빛 (달·행성 몇 개) |
| 175 | 박명/금성/구름 | [Commons](https://commons.wikimedia.org/wiki/File:Altocumulus_and_Venus_at_dawn_7th_Brigade_Park_Chermside_L1150015.jpg) | 1960 | 모름 (1위 후보 5.3), 재시도 모름, 60초: 27초에 끝, 모름 | 9.04 |  |  |  |  |  | E. 새벽 박명 + 구름 (금성 하나) |
| 176 | 박명/화산/도시광 | [Commons](https://commons.wikimedia.org/wiki/File:161029-volcan-de-fuego-venus-saturno-antares.jpg) | 384 | 모름 (1위 후보 5.4), 재시도 모름, 60초: 7초에 끝, 모름 | 5.83 |  |  |  |  |  | E. 박명 + 도시 불빛이 상위 검출 (행성 셋) |
| 177 | 박명/초승달/금성 | [Commons](https://commons.wikimedia.org/wiki/File:D%C3%BCnsberg_mit_Dezember-Neumond_und_Abendstern_vom_Hasenkopf_Marburg_2016-12-04.jpg) | 2689 | 모름 (1위 후보 5.0), 재시도 모름, 60초: 11초에 끝, 모름 | 8.97 |  |  |  |  |  | E. 박명 (초승달·금성), 별 거의 없음 |
| 178 | 박명/한국/사찰 | [Commons](https://commons.wikimedia.org/wiki/File:Night_Sky_In_Andong_Korea_(203229719).jpeg) | 2715 | 확신 | 0.05 | 39.3 | 28.5 | 36/2.5 (28.2) | 정답 / 맞음 | improved·사진 전체·25 |  |
| 179 | 박명/휴대폰느낌/나무 | [Commons](https://commons.wikimedia.org/wiki/File:Twilight_in_night_sky.jpg) | 4040 | 모름 (1위 후보 5.0), 재시도 모름, 60초: 16초에 끝, 모름 | 8.90 |  |  |  |  |  | E. 박명, 휴대폰 느낌의 어둡고 잡음 많은 사진 |
| 180 | 달/오로라/구름 | [Commons](https://commons.wikimedia.org/wiki/File:Aurora-mm_002_(8067076199).jpg) | 1037 | 확신 | 0.41 | 56.3 | 67.9 | 73/3.2 (70.3) | 정답 / 맞음 | triangle·사진 전체·15 |  |
| 181 | 달/구름 | [Commons](https://commons.wikimedia.org/wiki/File:Kalahari_(2006)_13.jpg) | 264 | 모름 (1위 후보 5.7), 재시도 모름, 60초: 7초에 끝, 모름 | 6.71 |  |  |  |  |  | E. 달 + 달빛 받은 구름 가장자리가 상위 검출 (별다운 검출 0개) |
| 182 | 달/행성/박명 | [Commons](https://commons.wikimedia.org/wiki/File:Moon_venus_jup.JPG) | 979 | 모름 (1위 후보 4.3), 재시도 모름, 60초: 30초에 끝, 모름 | 8.88 |  |  |  |  |  | E. 박명 + 초승달 + 나뭇잎 가장자리가 상위 검출 |
| 183 | 달/나무 | [Commons](https://commons.wikimedia.org/wiki/File:Full_Moon_At_A_Clear_Night_Sky_(94791911).jpeg) | 2282 | 확신 | 0.11 | 45.9 | 18.1 | 27/2.3 (19.3) | 정답 / 맞음 | improved·사진 전체·40 |  |
| 184 | 달/호수/산 | [Commons](https://commons.wikimedia.org/wiki/File:Lake_Bohinj_On_A_Calm_Night_(220300239).jpeg) | 1158 | 확신 | 0.05 | 47.4 | 30.4 | 40/2.1 (35.7) | 정답 / 맞음 | improved·사진 전체·25 |  |
| 185 | 달/휴대폰느낌 | [Commons](https://commons.wikimedia.org/wiki/File:Moonlit_Night_Sky_with_Scattered_Stars.jpg) | 8935 | 모름 (1위 후보 8.4), 재시도 모름, 60초: 41초에 끝, 모름 | 8.95 |  |  |  |  |  | E. 달·구름, 휴대폰 사진 (별다운 검출 195개) |
| 186 | 달/텐트/눈 | [Commons](https://commons.wikimedia.org/wiki/File:Pokut_Yaylas%C4%B1_3.jpg) | 2240 | 확신 | 0.15 | 46.4 | 26.4 | 37/2.2 (31.4) | 정답 / 맞음 | triangle·사진 전체·15 |  |
| 187 | 도시광/오로라/북두칠성 | [Commons](https://commons.wikimedia.org/wiki/File:-Light_Pollution,_Aurora_Borealis_And_The_Big_Dipper_-_20250903-A6500951.JPG-_(54762374654).jpg) | 609 | 확신 | 0.15 | 51.0 | 27.8 | 41/2.7 (33.0) | 정답 / 맞음 | improved·사진 전체·60 |  |
| 188 | 도시광/오로라/물반사/눈 | [Commons](https://commons.wikimedia.org/wiki/File:DSC04400_(55034504416).jpg) | 2914 | 확신 | 5.39 | 61.2 | 46.4 | 56/5.0 (38.0) | 정답 / 맞음 | triangle·위쪽 55%·15 |  |
| 189 | 도시광/별궤적 | [Commons](https://commons.wikimedia.org/wiki/File:2014-02-23_21-05-59_file-etoiles-11f.jpg) | 2141 | 모름 (1위 후보 4.9), 재시도 모름, 60초: 24초에 끝, 모름 | 8.88 |  |  |  |  |  | H. 별 궤적 + 광해 |
| 190 | 도시광/건물/행성 | [Commons](https://commons.wikimedia.org/wiki/File:London_MMB_E0_Palace_of_Westminster_with_Jupiter_and_Venus.jpg) | 617 | 모름 (1위 후보 5.3), 재시도 모름, 60초: 41초에 끝, 모름 | 9.07 |  |  |  |  |  | E. 도시 불빛 (빅벤·가로등), 별 거의 없음 |
| 191 | 도시광/텐트/광해 | [Commons](https://commons.wikimedia.org/wiki/File:Night_P%D0%B0radise.jpg) | 2991 | 모름 (1위 후보 5.2), 재시도 모름, 60초: 26초에 끝, 모름 | 8.90 |  |  |  |  |  | C. 광각 가장자리 + 광해: 가장자리 12% 빼면 확신 (시야 74°, 꼬리 12.5) |
| 192 | 도시광/거리/나무 | [Commons](https://commons.wikimedia.org/wiki/File:Wilhelm-Kohlhoff-Stra%C3%9Fe_bei_Nacht_20230821_HOF06616_RAW-Export_cens.png) | 3800 | 모름 (1위 후보 4.3), 재시도 모름, 60초: 10.5초에 확신 | 8.83 | 67.8 | 18.0 | 27/3.1 (16.2) | 정답 / 맞음(약함, 별이 희미해 별자리 모양은 알아보기 어려움 — 투영 별이 검출과 겹침) |  | A. 8초 부족 (60초 상한에서 10.5초에 확신, 거리 불빛·나무) |
| 193 | 도시광/구름/눈/바다 | [Commons](https://commons.wikimedia.org/wiki/File:Night_In_Paradise_(138497861).jpeg) | 2048 | 모름 (1위 후보 4.9), 재시도 모름, 60초: 39초에 끝, 모름 | 9.03 |  |  |  |  |  | E. 구름 + 마을 불빛·반사가 상위 검출 |
| 194 | 구름/들판 | [Commons](https://commons.wikimedia.org/wiki/File:Nubi_notturne_su_Trecate_viste_da_Garbagna_Novarese.jpg) | 3704 | 모름 (1위 후보 5.3), 재시도 모름, 60초: 25초에 끝, 모름 | 8.85 |  |  |  |  |  | E. 구름 + 조명 받은 풀밭이 상위 검출 |
| 195 | 구름/오리온 | [Commons](https://commons.wikimedia.org/wiki/File:Orion_in_Winter_(46689068132).jpg) | 3369 | 확신 | 0.09 | 48.5 | 44.3 | 61/4.0 (48.9) | 정답 / 맞음 | improved·사진 전체·40 |  |
| 196 | 구름/나무 | [Commons](https://commons.wikimedia.org/wiki/File:Long_exposure_of_night_sky_in_colorado.jpg) | 948 | 모름 (1위 후보 8.6), 재시도 모름, 60초: 36초에 끝, 모름 | 8.84 |  |  |  |  |  | E. 흐르는 구름 + 조명 받은 나무가 상위 검출 (1위 후보 꼬리 8.9로 애매) |
| 197 | 구름/나무/숲 | [Commons](https://commons.wikimedia.org/wiki/File:Nuit_%C3%A9toil%C3%A9e_en_for%C3%AAt_de_Rambouillet_%E2%80%94_02.jpg) | 4425 | 확신 | 0.05 | 38.3 | 40.6 | 47/1.9 (46.8) | 정답 / 맞음 | improved·사진 전체·25 |  |
| 198 | 희미함/휴대폰느낌 | [Commons](https://commons.wikimedia.org/wiki/File:Night_Sky,_Early_September_2021.jpg) | 6958 | 확신 | 0.07 | 53.1 | 85.7 | 86/3.6 (83.8) | 정답 / 맞음 | improved·사진 전체·40 |  |
| 199 | 희미함/휴대폰느낌 | [Commons](https://commons.wikimedia.org/wiki/File:Long_Time_Exposure_of_Night_sky.jpg) | 4790 | 확신 | 0.08 | 38.3 | 33.8 | 44/2.5 (38.0) | 정답 / 맞음 | improved·사진 전체·40 |  |
| 200 | 희미함/짧은궤적/도시광 | [Commons](https://commons.wikimedia.org/wiki/File:Sternenhimmel_%C3%BCber_Hof_(Saale)_20230821_HOF06617_RAW-Export.png) | 1363 | 모름 (1위 후보 5.2), 재시도 모름, 60초: 40초에 끝, 모름 | 8.88 |  |  |  |  |  | H. 희미한 짧은 별 궤적 + 광해 |

## 6. 실패 분석

8초에 확신 못 한 98장을 증거로 나눴다. 증거는 ① 검출 상위 60·61~100·101~150개와 1위 후보를 사진에 그려 눈으로 본 것,
② 60초 상한 결과, ③ 진단 실험(아래), ④ EXIF·출처 분류다.

### 6.1 진단 실험 (알고리즘 코드는 그대로, 넣는 검출 목록만 바꿈)

60초로도 못 푼 사진에만 돌렸다 (처음 100장 몫은 33~36장, 새 91장 몫은 52장).

| 실험 | 바꾼 것 | 새로 확신 |
|---|---|---|
| 시간 60초 | 시간 상한만 | 075·078·092·128·173·192 (6장, 10~32초, 정답·애매) + **104 (28.5초, 틀린 답)** + 158 (18초, 숫자로 오답·눈으로 맞아 보임) |
| 별다움 지우기 | 검출의 `ringContrast`를 지워 밝기 순으로만 | 061·088·145 (3장, 꼬리 14.4·20.2·12.5) + **148 (틀린 답, 꼬리 2.6)** |
| 별다움 기준 완화 | `ringContrast`를 반으로 (기준 0.12 → 0.24 효과) | 061·088·145 (같은 3장), 141 (꼬리 8.3 애매) + **148·185 (틀린 답, 꼬리 2.6·7.5)** |
| 가장자리 빼기 | 사진 가장자리 12% / 20% (처음 100장은 25%도) 띠의 검출을 뺌 | 006·067·077·090·107·112·113·117·139·142·191 (11장, 067·107·112·113은 log-odds나 꼬리가 애매, 093은 꼬리 6.3이라 제외) |
| 칸마다 고르기 | 4×3 칸마다 우선순위 앞 5개를 맨 앞으로 | 107·142·145 (3장, 꼬리 13.9·26.2·12.5) |

- 별다움을 지우거나 늦추면 풀리는 사진이 몇 장 늘지만 **틀린 확신도 생긴다**(148·185). 별다움을 통째로 빼는 게 답이 아니고, 밝은 별 일부를 잘못 밀어내는 게 문제다.
- 가장자리 빼기가 가장 많이 풀었다(11장). 새 사진에서도 시야 53~80°의 광각 사진이 가장자리만 빼면 풀렸다.
- 칸마다 고르기(공간 분산)는 107·142·145에 효과가 있었다.

### 6.2 원인별 개수와 대표 사례

| 기호 | 원인 | 사진 수 | 사진 | 대표 사례·증거 |
|---|---|---|---|---|
| A | 8초 부족 | 6 | 075·078·092·128·173·192 | 092는 8초 때 이미 1위 후보가 정답(꼬리 18.6)이었지만 log-odds 6.4라 확신 못 함. 60초면 10.5초에 정밀화로 21.7. 128은 31.6초에 위쪽 45% 영역에서 확신 |
| B | 어안·초광각·파노라마 (직선투영 모델 밖) | 16 | 009·013·021·031·032·033·034·035·087·068·089·163·164·165·167·169 | 원형 전천 사진 6장(031~034·163·165)은 하나도 못 풀었다. 068은 세로 파노라마(여러 장을 이어 붙임). 089는 EXIF 14mm 풀프레임 세로 → 짧은 변 81°로 후보(10~75°) 밖. 169는 숲에서 하늘을 올려다본 어안 |
| C | 광각 가장자리 왜곡 | 11 | 006·067·077·090·107·112·113·117·139·142·191 | 가장자리 검출을 빼면 확신. 시야 53~80°. 107은 8초 1위 후보가 이미 정답(꼬리 14.0)이었고, 칸마다 고르기로도 풀렸다. 142는 칸마다 고르기로 꼬리 26.2. 못 푼 사진은 상위 60개 중 가장자리 12% 띠에 있는 비율이 평균 0.49 (풀린 사진 0.43, 띠 넓이 0.42) |
| D | 밝은 별이 별다움 기준에서 밀림 (+ 좁은 시야) | 6 | 058·061·088·141·145·148 | 061: 오리온 벨트 세 별·M42가 화면에 있는데 벨트 별이 상위에 없음. 별다움을 지우면 시야 6.9°로 정답. 145: 시야 15° 오리온, 8초 1위 후보(8.5)가 이미 정답이고 별다움을 지우면 확신. 148: 남십자 별밭, 별다움을 지우면 오히려 틀린 답 |
| E | 지상 불빛·구름·박명·달이 검출을 차지 | 23 | 001·025·026·028·070·103·104·158·170·171·172·174·175·176·177·179·181·182·185·190·193·194·196 | 박명 9장(170~179·182): 별이 몇 개뿐이고 하늘 밝기 기울기·첨탑·나뭇가지 가장자리가 상위 검출. 181: 달빛 받은 구름 가장자리뿐(별다운 검출 0개). 104는 60초에서 틀린 답을 확신, 158은 숫자로 오답(눈으로는 맞아 보임) |
| F | 별이 적음·좁은 시야 | 2 | 018·045 | 018: 별다운 검출 337개, 구름. 045: 플레이아데스 확대(약 22°), 1,240px 컴팩트 카메라, 5등급 이하 별이 몇 개 없음 |
| G | 원인 미확정 (대개 은하수 광각) | 23 | 039·072·073·074·081·083·086·091·093·097·098·111·118·119·120·122·123·124·125·126·130·132·143 | 60초로도, 진단 실험으로도 안 풀림. 공통점: 검출 2,200~7,300개로 많고, 상위 검출이 사진 구석·가장자리에 몰리고, 밝은 행성·별이 상위에 없는 경우가 보인다(083·090·072·122·130). 118은 8초 1위 후보(8.2)가 이미 정답(꼬리 15.5)인데 60초로도 기준 9를 못 넘었다 |
| H | 별 궤적 (별이 점이 아니라 선) | 11 | 153·154·155·156·157·159·160·161·162·189·200 | 200장으로 늘리며 새로 둔 기호. 검출이 궤적 위 여러 점으로 쪼개지거나(159 별다운 검출 24개) 원호가 줄지음으로 묶인다(156·162). 짧은 궤적인 158만 60초에 확신(숫자로 오답) |

**풀린 사진으로 잰 "밝은 별 밀림"의 크기** (8초 확신 102장의 답으로 3등급보다 밝은 별을 투영하고, 반경 안의 검출이 앱 우선순위 몇 위인지):
검출과 겹친 1,437개 중 상위 60 안 859개(60%), 61~150위 87개, **150위 밖 491개(34%)**. 150위 밖 중 339개는 별다움 0.12 이상이라 밀렸고, 78개는 줄지음으로 밀렸다.
1등급보다 밝은 128개 중에서도 29개가 150위 밖이었다. (지평선 아래에 투영된 별이 우연히 지상 검출과 겹친 경우가 섞여 있어 대략적인 값이다.)
풀린 사진에서도 밝은 별이 상당수 빠진 채 나머지 별로 풀렸다는 뜻이고, 별이 적은 사진·좁은 시야에서는 이게 실패로 이어진다(D).

**시각·장소·지평선 풀이** (sources.csv에 GPS가 있는 63장): 날짜만 있거나 올린 날짜뿐이라 시각이 없는 17장, 지평선 자동 제안이 없는 6장을 빼고 40장에 돌렸다.
시각은 카메라 현지 시각으로 보고 시간대는 경도/15로 어림했고(UTC 표시가 있으면 UTC), 앱 기본 범위(3시간 전~1시간 30분 뒤)가 그 앞뒤를 덮게 두었다.
확신은 4장: 055·109·127은 blind 답과 0.3° 안으로 같았고, **103은 blind로 못 푼 사진인데 시각·장소 풀이로 확신했다**.
103은 겹친 별 꼬리가 3.5라 숫자로는 "오답"이지만, 눈으로는 맞다: 그날(2024-05-10) 달은 초승달로 황소자리 엘나트 옆에 있었는데, 투영한 엘나트가 사진 속 달 바로 옆에 놓이고 마차부 카펠라가 밝은 별 위에 놓인다.
검출 189개 중 별다운 것이 11개뿐이고 상위가 나무 능선·마을 불빛이라 겹친 별 지표가 낮게 나왔다 (3.3절의 071·158과 같은 엇갈림).
079·096·106·178은 blind 답과 0.1~1.3° 안으로 같았지만 확신 못 했고, 나머지 32장은 다른 자세였다.
blind로 못 푼 사진 중 시각·장소 풀이를 돌린 22장에서는 103 하나만 풀렸다. 원인 후보: 자동 지평선이 나무·산 능선을 잡음(040은 기울어진 직선), Commons 시각의 시간대·정확도를 모름, 초광각·어안.

## 7. 고치려면 어디를 손대야 할지 (후보, 고치지 않음)

1. **가운데 영역 입력 (C, 11장)** — `SEARCH_REGIONS`(solvePhoto.ts)는 지면을 빼는 "위쪽 n%"만 있다. 가장자리를 빼는 "가운데 n%" 영역을 더하면 광각 왜곡을 피한다. 진단에서 가장자리 12~25%를 빼면 11장이 풀렸다 (일부는 겹친 별 지표가 애매한 수준). 200장에서 효과가 가장 큰 한 가지다.
2. **8초 안에 마무리하기 (A, 6장)** — `src/search/solvePhoto.ts`: 시간이 다 됐을 때(또는 모든 단계를 마쳤을 때) 1위 후보에도 `polish`(마무리 정밀화)를 한 번 돌리기. 092·107·118·145는 8초 때 1위 후보가 이미 정답이었다. journey 30장의 "삼각형 검증 전 값싼 거르기"도 같은 쪽.
3. **밝은 별을 별다움·줄지음으로 밀어내지 않기 (D·E 일부, 107)** — `src/search/utils/selectStars.ts`의 `isStarlike`/`byStarPriority`·`findAlignedStars`, `src/search/detectCore.ts`의 `ringContrast`. 밝게 번진 별은 주변 고리가 밝아 별답지 않게 나온다. 밝기 상위 몇 개는 별다움과 상관없이 앞에 두거나, 고리 반경을 별 크기에 맞추는 방법. 풀린 사진에서도 3등급보다 밝은 별의 34%가 150위 밖이었다. 다만 별다움을 통째로 빼면 틀린 확신이 생겼다(148·185) — 밝은 별 몇 개만 살리는 쪽이어야 한다.
4. **어안·초광각·파노라마 (B, 16장)** — 어안 blind 풀이(`src/search/fisheyeSolve.ts`·`FISHEYE_ACCEPT`)는 200장에서 한 번도 채택되지 않았다. 원형 전천 사진(검은 테두리)을 알아보고 어안 경로로 보내기. 직선투영 FOV 후보를 75° 위로 넓히거나 왜곡 계수(k1)를 직선 풀이에도 두기 (089·139). 이어 붙인 파노라마(068)는 직선투영 모델로는 풀 수 없다.
5. **별 궤적 (H, 11장)** — 지금 검출은 점 별을 전제한다. 궤적을 선분으로 검출해 한쪽 끝(또는 중점)을 별 위치로 쓰면 풀이 입력이 된다. 궤적 길이로 노출 시간·천구 극 위치까지 알 수 있다. 사람 협업으로는 "궤적 끝 찍기"가 쉬운 대안이다.
6. **박명·달·지상 불빛 (E, 23장)** — 이미 있는 자동 지평선(`horizonDetect.ts`)을 blind 풀이 입력에도 써서 지평선 아래 검출을 빼기. 박명 사진은 별이 몇 개뿐이라 blind 풀이보다 시각·장소 풀이(103처럼)나 사람이 밝은 별 몇 개를 찍어 주는 쪽이 맞다.
7. **좁은 시야 (D·F)** — FOV 후보 하한 10°와 5등급 카탈로그: 058(5°)·061(7°)처럼 망원 사진은 카탈로그 별이 몇 개뿐이다. 11°·14°·18°(149·144·146)는 풀렸으니 하한 근처가 경계다. 카탈로그 등급을 넓히면 quad가 폭발하므로(CLAUDE.md) 좁은 시야 전용으로만 어두운 별을 쓰는 방법.
8. **크게 일그러진 변환 거르기 (104)** — 60초에서 104가 log-odds 19.1로 틀린 답을 확신했다. 별자리가 한쪽 구석으로 몰릴 만큼 원근이 심한 변환이었다. 확신하기 전에 변환의 원근 정도(호모그래피의 원근 항, 화면 네 모서리가 하늘에서 차지하는 각도 비)를 보고 물리적으로 말이 안 되는 변환은 버리는 확인이 있으면 막을 수 있다. 앱의 8초 안에서는 생기지 않았지만 시간 상한을 늘리기 전에 필요하다.

## 8. 한계

- 판정에 쓴 상위 100개 검출은 풀이가 쓴 별(상위 15~60개)을 포함한다. 그래서 61~150위로 따로 쟀지만, 검출이 적은 사진에서는 그 값의 힘이 약하다. 눈 판정은 800px로 줄인 그림이다.
- "오답" 보정에 쓴 V2식 오답은 실제 V2 코드가 아니라, 지금 풀이가 내놓은 그럴듯한 오답 후보(73개)다.
- 원인 분류는 그림을 보고 사람이 정한 것이고, G(23장)는 원인을 확정하지 못했다. 진단 실험은 "그것만 바꾸면 풀린다"를 보일 뿐 유일한 원인이라는 증거는 아니다. H(별 궤적)는 200장으로 늘리며 새로 둔 기호다.
- 사진은 Commons의 1,920px 썸네일(재압축)이고 대부분 EXIF가 없다. 원본이나 휴대폰 사진과는 다를 수 있다. Commons에 올라온 사진은 보정·합성이 많은 "작품 사진" 쪽으로 치우친다. "휴대폰 느낌" 사진도 실제 휴대폰으로 찍었는지 확인하지 못했다.
- 새 91장은 일부러 어려운 조건(별 궤적·박명·어안·달)을 많이 넣었으므로, 200장의 확신 비율(51%)은 "일반인 사진 전체의 성공률"이 아니라 조건별로 나눠 읽어야 한다 (4장).
- 시간은 M3 Pro node 측정이다. 브라우저 Worker는 더 느릴 수 있다. 60초 진단과 진단 실험은 여러 개를 나란히 돌렸다.
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
| `horizon3.ts` · `cmpH.ts` | 시각·장소·지평선 풀이 (올린 날짜·"before" 시각은 건너뜀), blind 답과 비교 | `horizon3.ts <pass1 json>` (web 폴더 전용) |
| `rankStats3.ts` | 밝은 별 순위·가장자리 비율 통계 (200장) | 인자 없음 |
| `summarize3.ts` · `causes3.ts` | 보고서 표·분류별 집계 (200장, `pass*`·`newpass*`·`n91pass*`) · 어안 9장과 새 91장의 원인·눈 판정 | 인자 없음 |
| `brightRank.ts` | 가장 밝은 검출 몇 개의 우선순위·별다움·줄지음 | `brightRank.ts <파일>…` |

- 결과 이름: 처음 100장 `pass1`·`pass2`·`pass2b`·`pass60-*`·`diag-*`, 101~109 `newpass*`·`new-diag-*`, 110~200 `n91pass1`·`n91pass2`·`n91pass60-*`·`n91-diag-*`(모두 `out/`).
- 사진을 고른 기록: 처음 100장 `collect/`, 101~109 `collect2/`, 110~200 `collect3/`(후보 받기 `scripts/fetch3.py`, 거르기·축소 그림 `scripts/prep3.py`, 고른 목록 `picks3.tsv`, 내려받기·촬영자 2장 확인 `scripts/download3.py`, 어안 되돌리기 `scripts/restore.py`).
- 비교 페이지: `review_html/build.py <저장소> <validate 폴더>`가 5장 표와 `sources.csv`를 읽어 `public/samples-external/web-2026-10-review.html`(요약 숫자·분류별 막대·원인 막대·필터·카드별 출처)을 만든다 (gitignore).

**별하늘지기 카페 사진은 브라우저 안전 제한으로 못 받았다** — 사용자가 `public/samples-external/cafe-2026-10/`에 넣으면 같은 스크립트로 돌릴 수 있다:

```sh
S=/private/tmp/claude-504/-Users-ybbarng-personal-projects-star-byb-kr/0b1a2036-9418-4591-b809-960b2f90cd84/scratchpad/validate
node_modules/.bin/tsx --tsconfig tsconfig.json $S/detectAll.ts cafe-2026-10 0/1
node_modules/.bin/tsx --tsconfig tsconfig.json $S/run.ts cafe-2026-10 8000 cafe-pass1
NOBOX=1 node_modules/.bin/tsx --tsconfig tsconfig.json $S/overlay.ts cafe-2026-10 $S/out/cafe-pass1-0.json solved
```

결과는 `$S/out/cafe-pass1-0.json`(사진마다 확신 여부·시간·시야각·겹친 별), 그림은 `$S/img/`. 출처표가 없으면 분류 집계(`summarize3.ts`)와 시각·장소 풀이는 건너뛴다.

## 10. 다시 잰 결과 (2026-10-23 저녁)

보고서를 쓴 뒤 바뀐 것은 둘이다. ① 카탈로그에서 북쪽왕관자리 T(HR 5958, 1866년 폭발 때 밝기로 실려 있던 재발 신성)를 뺐다 (1,625 → 1,624개, quad 82,703 → 82,605개).
② 플레이트 솔버 화면 기능(`compass.ts`·`whereShot.ts` 등)을 더했다. 풀이·검출 코드(`solvePhoto`·`solveCore`·`solvers/`·`detectCore`·`selectStars`)는 보고서 커밋(b0d96b7) 뒤로 바뀌지 않았다.
검출 코드가 그대로라 검출 캐시는 다시 썼고, 같은 200장을 같은 스크립트(`run.ts`, 시간 상한 8초)로 다시 풀었다. 결과 이름은 `re2pass1-*`(4조각 나란히)·`re2pass2-*`(혼자 재시도)·`re2solo9-*`·`re2-horizon.json`(모두 `out/`).

**기계가 보고서 때보다 바빴다**: 이번에는 백신 검사(ESET `scand`, CPU 약 150%)와 브라우저가 함께 돌아 부하 평균이 8~12였다. 그래서 시간 상한 근처에서 풀리던 사진이 8초를 넘겼다.

| | 보고서 (혼자, 8초) | 다시 잼: 4조각 나란히 8초 | 다시 잼: 못 푼 사진만 혼자 8초 재시도 |
|---|---|---|---|
| 확신 | 102 | 93 | 93 + 6 = **99** |
| 그중 정답 / 애매 | 101 / 1 (071) | 92 / 1 (071) | 98 / 1 (071) |
| 틀린 답을 확신 | 0 | **0** | **0** |
| 모름 | 98 | 107 | 101 |

- **틀린 확신은 여전히 0장이다.** 확신한 사진은 071(애매, 꼬리 9.1 — 보고서와 같은 값)을 빼고 모두 겹친 별 기준 정답이었다.
- **보고서에서 모름이던 98장은 이번에도 모두 모름**이다. 새로 풀린 사진은 없다.
- **결과가 바뀐 사진은 9장이고, 모두 "확신 → 모름"**이다: 015·027·063·080·095·096·100·129·188. 보고서에서 3.8~8.0초 걸리던, 시간이 오래 걸리는 쪽 사진들이다.
  - 혼자 다시 돌리니 063·080·095·100·129·188은 4.6~7.2초에 같은 답으로 확신했다.
  - 096은 한 번은 7.8초에 확신했고(`re2solo9`), 재시도에서는 8초를 넘겨 모름 — 경계에 걸쳐 있다.
  - 015(보고서 7.70초)는 시간 상한 12초로 10.5초, 027(보고서 8.04초)은 30초로 9.9초에 확신했다. 둘 다 보고서와 같은 단계(18·24번째)에서 같은 답이다.
- **분류별** (보고서 → 나란히 → 혼자 재시도까지): 은하수 21 → 16 → 20 (080·095·096·100·129, 재시도 뒤 096만 빠짐), 도시 불빛 9 → 7 → 8 (027·188), 구름 10 → 9 → 9 (015), 희미함 7 → 6 → 7 (063). 나머지 분류는 그대로다 (별자리 24, 오로라 13, 별밭 8, 달 4, 망원 3, 어안 2, 박명 1, 별 궤적 0, 번개구름 0).

**바뀐 원인은 기계 속도이지 알고리즘이 아니다.** 근거:

- 두 번 다 확신한 사진(나란히 93장 + 혼자 7장 + 015·027)은 **확신한 단계 번호가 보고서와 모두 같고, 답(광축)의 차이가 0.000°**다.
- 평가한 후보 수는 사진마다 0~90개(0.1% 미만) 다르다. 별 하나가 빠져 quad 98개와 그 별이 낀 삼각형이 사라진 만큼이다.
- log-odds가 달라진 사진은 4장이고 모두 조금 올랐다 (043 48.1 → 48.3, 063 53.9 → 54.1, 069 54.6 → 54.8, 184 30.4 → 30.6). 아마 화면에 투영되던 T CrB 자리가 빠져 우연히 맞을 기대가 조금 줄었기 때문일 것이다. 판정을 바꿀 크기는 아니다.
- 대신 시간이 늘었다. 0.3초 넘게 걸린 사진의 시간 비율(새/보고서)이 4조각 나란히는 중앙 1.70배(0.73~2.54), 혼자 돌릴 때도 1.16~1.27배였다. 보고서에서 3.8초 넘게 걸린 사진이 8초를 넘기기에 충분하다.
- 그러니 보고서와 같은 조건(다른 일 없이 혼자)이라면 102장으로 돌아올 것으로 본다. 다만 015(7.7초)·027(8.0초)·096(6.9초)은 원래부터 8초 경계에 걸쳐 있어서, 기계가 조금만 바빠도 빠지는 사진이다. 브라우저 Worker가 node보다 느리면 앱에서도 이 사진들은 못 풀 수 있다.

**시간**:

| | 보고서 | 다시 잼 |
|---|---|---|
| 확신한 사진 중앙값 | 0.09초 | 0.18초 (나란히 93장) |
| 1초 안에 확신 | 102장 중 76 | 93장 중 72 |
| 가장 오래 걸린 확신 | 8.0초 (027) | 7.2초 (085, 나란히) / 7.2초 (129, 혼자) |
| 모름 사진 | 대개 8.8~9.2초 | 혼자 재시도 중앙 9.1초, 101장 중 96장이 시간 상한에 걸림, 가장 긴 것 12.1초 |

모름 사진의 마지막 단계가 상한을 넘겨 끝나는 것은 보고서와 같지만, 바쁜 기계에서는 그 넘는 폭이 4초까지 커졌다.

**시각·장소·지평선 풀이** (`horizon3.ts`와 같은 내용, 출력만 `re2-horizon.json`): GPS 있는 63장 중 40장에 돌렸고(23장은 시각 없음·지평선 없음으로 건너뜀, 보고서와 같음),
40장 모두 log-odds가 보고서와 같은 값이었다. 확신은 055·103·109·127 네 장으로 보고서와 같다.
blind 답과 2° 안으로 같은 것도 055·109·127(확신)과 079·096·106·178(모름)로 보고서와 같다.

정리하면, T CrB를 뺀 것은 이 200장의 풀이 결과를 바꾸지 않았다. 숫자가 102 → 93/99로 내려간 것은 측정할 때 기계가 바빴던 탓이고, 8초 경계에 걸친 사진이 10장 가까이 있다는 것을 다시 보여 준다 (7장 2번 "8초 안에 마무리하기"와 같은 이야기).
