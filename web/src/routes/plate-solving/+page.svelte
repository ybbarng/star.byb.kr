<script lang="ts">
  import ImageUploader from '$lib/component/ImageUploader.svelte';
  import StarMarker from '$lib/component/StarMarker.svelte';
  var imageDataUrl: string;
  var imageWidth = 0;
  var imageHeight = 0;
</script>
<h1>천체 이미지 분석</h1>
<p>천체 이미지 분석 페이지입니다.</p>
{#if imageDataUrl && imageHeight > 0}
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
    <StarMarker
      bind:imageDataUrl={imageDataUrl}
      bind:imageWidth={imageWidth}
      bind:imageHeight={imageHeight}
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
