/**
 * With OpenCV we have to work with the images as cv.Mat (matrices),
 * so you'll have to transform the ImageData to it.
 */
function imageProcessing(cv, { msg, payload }) {
  const img = cv.matFromImageData(payload)
  let result = new cv.Mat()

  // This converts the image to a greyscale.
  cv.cvtColor(img, result, cv.COLOR_BGR2GRAY)
  postMessage({ msg, payload: imageDataFromMat(cv, result) })
}

/**
 * This function converts again from cv.Mat to ImageData
 */
function imageDataFromMat(cv, mat) {
  // converts the mat type to cv.CV_8U
  const img = new cv.Mat()
  const depth = mat.type() % 8
  const scale =
    depth <= cv.CV_8S ? 1.0 : depth <= cv.CV_32S ? 1.0 / 256.0 : 255.0
  const shift = depth === cv.CV_8S || depth === cv.CV_16S ? 128.0 : 0.0
  mat.convertTo(img, cv.CV_8U, scale, shift)

  // converts the img type to cv.CV_8UC4
  switch (img.type()) {
    case cv.CV_8UC1:
      cv.cvtColor(img, img, cv.COLOR_GRAY2RGBA)
      break
    case cv.CV_8UC3:
      cv.cvtColor(img, img, cv.COLOR_RGB2RGBA)
      break
    case cv.CV_8UC4:
      break
    default:
      throw new Error(
        'Bad number of channels (Source image must have 1, 3 or 4 channels)'
      )
  }
  const clampedArray = new ImageData(
    new Uint8ClampedArray(img.data),
    img.cols,
    img.rows
  )
  img.delete()
  return clampedArray
}

function findStars(cv, { msg, payload }) {
  const image = cv.matFromImageData(payload);

  let result = new cv.Mat();
  let hierarchy = new cv.Mat();
  let contours = new cv.MatVector();
  let gray = new cv.Mat();
  let blurred = new cv.Mat();

  // 회색조로 변경
  cv.cvtColor(image, gray, cv.COLOR_BGR2GRAY)

  // 가우시안 블러를 적용하여 노이즈 제거
  cv.GaussianBlur(gray, blurred, new cv.Size(51, 51), 0, 0, cv.BORDER_DEFAULT);

  // 블러를 제거하여 명료하게 만들기
  cv.subtract(gray, blurred, result);

  // 적절한 임계값을 설정하여 별과 배경 분리
  cv.threshold(result, result, 70, 255, cv.THRESH_BINARY);

  // Find contours (to simulate blob detection)
  cv.findContours(result, contours, hierarchy, cv.RETR_EXTERNAL, cv.CHAIN_APPROX_SIMPLE);

  // find stars
  const stars = [];
  for (let i = 0; i < contours.size(); i++) {
    let contour = contours.get(i);
    let moments = cv.moments(contour);
    if (moments.m00 > 0) {
      let cx = moments.m10 / moments.m00; // Centroid x
      let cy = moments.m01 / moments.m00; // Centroid y
      let radius = Math.sqrt(cv.contourArea(contour) / Math.PI); // Approx radius
      stars.push({cx, cy, radius});
    }
  }

  postMessage({ msg, payload: stars })
}

// Delaunay Triangulation
function findTriangles(cv, { msg, payload }) {
  const {points, width, height} = payload;

  // Create a Subdiv2D object for Delaunay triangulation
  let rect = new cv.Rect(0, 0, width, height);
  let subdiv = new cv.Subdiv2D(rect); // 여기서 TypeError: cv.Subdiv2D is not a constructor 가 발생해서 실행 불가능

  // Insert points into Subdiv2D
  points.forEach(point => subdiv.insert(new cv.Point(point[0], point[1])));

  // Get the list of triangles
  let triangleList = new cv.Mat();
  subdiv.getTriangleList(triangleList);
  const result = [];
  for (let i = 0; i < triangleList.rows; i++) {
    const pt = triangleList.data32F.subarray(i * 6, i * 6 + 6);
    const p1 = {x: pt[0], y: pt[1]};
    const p2 = {x: pt[2], y: pt[3]};
    const p3 = {x: pt[4], y: pt[5]};
    result.push([p1, p2, p3]);
  }
  postMessage({ msg, payload: result })
}

/**
 * This exists to capture all the events that are thrown out of the worker
 * into the worker. Without this, there would be no communication possible
 * with the project.
 */
onmessage = async function (e) {
  switch (e.data.msg) {
    case 'load': {
      // Import Webassembly script
      self.importScripts('./opencv.js');
      await cv;
      postMessage({ msg: e.data.msg });
      break
    }
    case 'imageProcessing':
      return imageProcessing(await cv, e.data)
    case 'findStars':
      return findStars(await cv, e.data)
    case 'findTriangles':
      return findTriangles(await cv, e.data)
    default:
      break
  }
}
