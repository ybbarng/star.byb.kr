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
 * 5. 주변 5×5 영역에서 weighted centroid (서브픽셀 정확도)
 * 6. brightness = 차영상 픽셀값 (0~255)
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

  const stars = [];
  const margin = 3; // 8방향 이웃 비교를 위한 경계 마진

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

      // 주변 5×5 영역에서 weighted centroid (서브픽셀 정확도)
      let sumW = 0, sumWx = 0, sumWy = 0;
      for (let dy = -2; dy <= 2; dy++) {
        for (let dx = -2; dx <= 2; dx++) {
          const ny = y + dy;
          const nx = x + dx;
          if (ny < 0 || ny >= rows || nx < 0 || nx >= cols) continue;
          const w = data[ny * cols + nx];
          sumW += w;
          sumWx += w * nx;
          sumWy += w * ny;
        }
      }

      const cx = sumW > 0 ? sumWx / sumW : x;
      const cy = sumW > 0 ? sumWy / sumW : y;

      stars.push({ cx, cy, brightness: val });
    }
  }

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
