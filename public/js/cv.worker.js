/**
 * With OpenCV we have to work with the images as cv.Mat (matrices),
 * so you'll have to transform the ImageData to it.
 */
function testImageProcessing(cv, payload) {
  const img = cv.matFromImageData(payload);
  let result = new cv.Mat();
  let blurred = new cv.Mat();

  // This converts the image to a greyscale.
  cv.cvtColor(img, result, cv.COLOR_BGR2GRAY);

  // 가우시안 블러를 적용하여 노이즈 제거
  cv.GaussianBlur(
    result,
    blurred,
    new cv.Size(51, 51),
    0,
    0,
    cv.BORDER_DEFAULT,
  );

  // 블러를 제거하여 명료하게 만들기
  cv.subtract(result, blurred, result);

  // 적절한 임계값을 설정하여 별과 배경 분리
  cv.threshold(result, result, 70, 255, cv.THRESH_BINARY);

  cv.bitwise_not(result, result);

  return imageDataFromMat(cv, result);
}

/**
 * This function converts again from cv.Mat to ImageData
 */
function imageDataFromMat(cv, mat) {
  // converts the mat type to cv.CV_8U
  const img = new cv.Mat();
  const depth = mat.type() % 8;
  const scale =
    depth <= cv.CV_8S ? 1.0 : depth <= cv.CV_32S ? 1.0 / 256.0 : 255.0;
  const shift = depth === cv.CV_8S || depth === cv.CV_16S ? 128.0 : 0.0;
  mat.convertTo(img, cv.CV_8U, scale, shift);

  // converts the img type to cv.CV_8UC4
  switch (img.type()) {
    case cv.CV_8UC1:
      cv.cvtColor(img, img, cv.COLOR_GRAY2RGBA);
      break;
    case cv.CV_8UC3:
      cv.cvtColor(img, img, cv.COLOR_RGB2RGBA);
      break;
    case cv.CV_8UC4:
      break;
    default:
      throw new Error(
        "Bad number of channels (Source image must have 1, 3 or 4 channels)",
      );
  }

  const clampedArray = new ImageData(
    new Uint8ClampedArray(img.data),
    img.cols,
    img.rows,
  );
  img.delete();

  return clampedArray;
}

/**
 * Local Maxima 기반 별 검출
 * 1. 차영상(gray - blurred)에서 mean + stddev 계산
 * 2. 적응적 threshold = mean + 3×stddev
 * 3. 8방향 이웃과 비교하여 local maxima 검출
 * 4. threshold 이상인 maxima만 별 후보
 * 5. 유효 반경 측정: peak에서 바깥으로 확장하며 threshold 이하가 되는 거리
 * 6. Non-maximum suppression: 가까운 후보끼리 합쳐서 별 하나로 처리
 * 7. 유효 반경 범위 내에서 weighted centroid (서브픽셀 정확도)
 * 8. brightness = 유효 반경 (겉보기 크기, 밝은 별일수록 큰 값)
 */
function findStars(cv, payload) {
  const image = cv.matFromImageData(payload);
  const gray = new cv.Mat();
  const blurred = new cv.Mat();
  const diff = new cv.Mat();

  // 회색조로 변경
  cv.cvtColor(image, gray, cv.COLOR_BGR2GRAY);

  // 가우시안 블러를 적용하여 노이즈 제거
  cv.GaussianBlur(gray, blurred, new cv.Size(51, 51), 0, 0, cv.BORDER_DEFAULT);

  // 차영상: 별만 남김
  cv.subtract(gray, blurred, diff);

  const rows = diff.rows;
  const cols = diff.cols;
  const data = diff.data;

  // mean + stddev 계산
  const mean = new cv.Mat();
  const stddev = new cv.Mat();
  cv.meanStdDev(diff, mean, stddev);
  const meanVal = mean.doubleAt(0, 0);
  const stddevVal = stddev.doubleAt(0, 0);
  const threshold = meanVal + 3 * stddevVal;

  // 1단계: 모든 local maxima 후보 수집
  const candidates = [];
  const margin = 3;
  const maxRadius = 50;

  for (let y = margin; y < rows - margin; y++) {
    for (let x = margin; x < cols - margin; x++) {
      const val = data[y * cols + x];

      // threshold 이상인 픽셀만 후보
      if (val < threshold) continue;

      // 8방향 이웃과 비교하여 local maxima 확인
      let isMax = true;
      for (let dy = -1; dy <= 1 && isMax; dy++) {
        for (let dx = -1; dx <= 1 && isMax; dx++) {
          if (dy === 0 && dx === 0) continue;
          if (data[(y + dy) * cols + (x + dx)] > val) {
            isMax = false;
          }
        }
      }

      if (!isMax) continue;

      // 유효 반경 측정: 4방향(상하좌우)으로 확장하며 threshold 아래로 떨어지는 거리의 평균
      let radiusSum = 0;
      const directions = [[0, -1], [0, 1], [-1, 0], [1, 0]];
      for (const [ddx, ddy] of directions) {
        let r = 1;
        while (r <= maxRadius) {
          const ny = y + ddy * r;
          const nx = x + ddx * r;
          if (ny < 0 || ny >= rows || nx < 0 || nx >= cols) break;
          if (data[ny * cols + nx] < threshold) break;
          r++;
        }
        radiusSum += r - 1;
      }
      const effectiveRadius = radiusSum / directions.length;

      candidates.push({ x, y, peakVal: val, effectiveRadius });
    }
  }

  // 2단계: Non-maximum suppression — 가까운 후보를 하나의 별로 합침
  // 밝은(반경 큰) 후보부터 처리하여, 이미 채택된 별의 반경 내에 있는 후보는 제거
  candidates.sort((a, b) => b.effectiveRadius - a.effectiveRadius || b.peakVal - a.peakVal);

  const suppressed = new Uint8Array(candidates.length);
  const merged = [];

  for (let i = 0; i < candidates.length; i++) {
    if (suppressed[i]) continue;

    const star = candidates[i];
    // 억제 반경: 유효 반경의 2배 또는 최소 3픽셀
    const suppressRadius = Math.max(3, star.effectiveRadius * 2);
    const suppressRadiusSq = suppressRadius * suppressRadius;

    // 이 별보다 작은(뒤에 있는) 후보들 중 가까운 것을 억제
    for (let j = i + 1; j < candidates.length; j++) {
      if (suppressed[j]) continue;
      const dx = candidates[j].x - star.x;
      const dy = candidates[j].y - star.y;
      if (dx * dx + dy * dy <= suppressRadiusSq) {
        suppressed[j] = 1;
      }
    }

    merged.push(star);
  }

  // 3단계: 합쳐진 별에 대해 weighted centroid 계산
  const stars = merged.map(function (star) {
    const centroidRadius = Math.max(2, Math.ceil(star.effectiveRadius));
    let sumW = 0, sumWx = 0, sumWy = 0;
    for (let dy = -centroidRadius; dy <= centroidRadius; dy++) {
      for (let dx = -centroidRadius; dx <= centroidRadius; dx++) {
        const ny = star.y + dy;
        const nx = star.x + dx;
        if (ny < 0 || ny >= rows || nx < 0 || nx >= cols) continue;
        const w = data[ny * cols + nx];
        sumW += w;
        sumWx += w * nx;
        sumWy += w * ny;
      }
    }

    const cx = sumW > 0 ? sumWx / sumW : star.x;
    const cy = sumW > 0 ? sumWy / sumW : star.y;

    return { cx, cy, brightness: star.effectiveRadius };
  });

  image.delete();
  gray.delete();
  blurred.delete();
  diff.delete();
  mean.delete();
  stddev.delete();

  return stars;
}

/**
 * This exists to capture all the events that are thrown out of the worker
 * into the worker. Without this, there would be no communication possible
 * with the project.
 */
onmessage = async function (e) {
  switch (e.data.msg) {
    case "load": {
      // Import Webassembly script
      self.importScripts("./opencv.js");
      await cv;
      postMessage({ msg: e.data.msg, messageId: e.data.messageId });
      break;
    }

    case "testImageProcessing": {
      const payload = testImageProcessing(await cv, e.data.payload);
      postMessage({ ...e.data, payload });
      break;
    }

    case "findStars": {
      const payload = findStars(await cv, e.data.payload);
      postMessage({ ...e.data, payload });
      break;
    }

    default:
      break;
  }
};
