<script lang="ts">
  import type { MarkedImage } from '$lib/plate-solving/value-object/marked-image';
  import type { Star } from '$lib/plate-solving/value-object/star'

  export var imageDataUrl: string;
  var image: HTMLImageElement;
  export var markedImage: MarkedImage;

  const onImageLoaded = () => {
    markedImage = {
      width: image.width,
      height: image.height,
      stars: []
    }
  }
  const onMouseClickedOnImage = (event) => {
    const rectOfCanvas = image.getBoundingClientRect();
    const x = event.clientX - rectOfCanvas.left;
    const y = event.clientY - rectOfCanvas.top;
    console.log(`Mouse clicked: (${x}, ${y})`)
    markedImage.stars.push({x, y});
    markedImage['stars'] = markedImage.stars;
  }
</script>

<div class="star-marker">
<img id="image" src={imageDataUrl} alt="the resource to be solved" draggable="false"
  bind:this={image}
  on:load={() => onImageLoaded()}
  on:mousedown={(event) => onMouseClickedOnImage(event)}
/>
</div>
