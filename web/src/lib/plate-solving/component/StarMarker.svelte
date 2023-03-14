<script lang="ts">
  import type { MarkedImage } from '$lib/plate-solving/value-object/marked-image';
  import type { Star } from '$lib/plate-solving/value-object/star';
  import starImageAsset from '$lib/plate-solving/assets/star.png';

  export var imageDataUrl: string;
  export var markedImage: MarkedImage;
  var canvas: HTMLCanvasElement;
  var image: HTMLImageElement = new Image();
  var starImage: HTMLImageElement = new Image();
  starImage.src = starImageAsset;
  console.log(starImageAsset);

  const drawCanvas = (width: number, height:number) => {
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext('2d');
    context.drawImage(image, 0, 0, width, height);
  }

  const drawStarOnCanvas = (x: number, y:number) => {
    const context = canvas.getContext('2d');
    const starX = x - (starImage.width / 2);
    const starY = y - (starImage.height / 2);
    context.drawImage(starImage, starX, starY, starImage.width, starImage.height);
  }

  const onImageLoaded = () => {
    markedImage = {
      width: image.width,
      height: image.height,
      stars: []
    }
    drawCanvas(image.width, image.height);
  }
  const onMouseClickedOnImage = (event) => {
    const rectOfCanvas = canvas.getBoundingClientRect();
    const x = event.clientX - rectOfCanvas.left;
    const y = event.clientY - rectOfCanvas.top;
    console.log(`Mouse clicked: (${x}, ${y})`)
    markedImage.stars.push({x, y});
    markedImage['stars'] = markedImage.stars;
    drawStarOnCanvas(x, y);
  }

  image.src = imageDataUrl;
  image.onload = () => {
    onImageLoaded();
  }
</script>

<div class="star-marker">
<canvas
  bind:this={canvas}
  on:mousedown={(event) => onMouseClickedOnImage(event)}
/>
</div>
