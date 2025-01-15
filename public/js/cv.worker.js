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
    default:
      break
  }
}
