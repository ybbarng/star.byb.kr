<script lang="ts">
  export var imageDataUrl: string;
  var image: HTMLImageElement;
  export var imageWidth = 0;
  export var imageHeight = 0;
  const onImageLoaded = () => {
    imageWidth = image.width;
    imageHeight = image.height;
  }
  const onMouseClickedOnImage = (event) => {
    const rectOfCanvas = image.getBoundingClientRect();
    const x = event.clientX - rectOfCanvas.left;
    const y = event.clientY - rectOfCanvas.top;
    console.log(`Mouse clicked: (${x}, ${y})`)
  }
</script>

<div class="star-marker">
<img id="image" src={imageDataUrl} alt="the resource to be solved" draggable="false"
  bind:this={image}
  on:load={() => onImageLoaded()}
  on:mousedown={(event) => onMouseClickedOnImage(event)}
/>
</div>
