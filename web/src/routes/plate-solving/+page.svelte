<script lang="ts">
  import ImageUploader from '$lib/component/ImageUploader.svelte';
  var imageDataUrl: string;
  var image: HTMLImageElement;
  var imageDataUrl: string;
  var imageWidth = 0;
  var imageHeight = 0;
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
<h1>천체 이미지 분석</h1>
<p>천체 이미지 분석 페이지입니다.</p>
{#if imageDataUrl && image && imageHeight > 0}
<div id="image-info">
<ul>
  <li>이미지 가로: {imageWidth}</li>
  <li>이미지 세로: {imageHeight}</li>
</div>
{/if}
<div class="container">
  {#if !imageDataUrl}
    <ImageUploader bind:imageDataUrl={imageDataUrl} />
  {:else}
    <img id="image" src={imageDataUrl} alt="image to be solved" draggable="false"
      bind:this={image}
      on:load={() => onImageLoaded()}
      on:mousedown={(event) => onMouseClickedOnImage(event)}
    />
  {/if}
</div>

<style>
    .container {
        width: 100%;
        min-height: 600px;
        border: 1px black solid;
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
    }
</style>