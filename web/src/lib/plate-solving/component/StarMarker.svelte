<script lang="ts">
  import type { MarkedImage } from '$lib/plate-solving/value-object/marked-image';
  import type { Star } from '$lib/plate-solving/value-object/star'

  export var imageDataUrl: string;
  export var markedImage: MarkedImage;
  var canvas: HTMLCanvasElement;
  var image: HTMLImageElement = new Image();

  const drawCanvas = (width: number, height:number) => {
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext('2d');
    context.drawImage(image, 0, 0, width, height);
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
