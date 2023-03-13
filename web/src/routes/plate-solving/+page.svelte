<script lang="ts">
  import ImageUploader from '$lib/plate-solving/component/ImageUploader.svelte';
  import StarMarker from '$lib/plate-solving/component/StarMarker.svelte';
  import type { MarkedImage } from '$lib/plate-solving/value-object/marked-image';

  var imageDataUrl: string;
  var markedImage: MarkedImage;
</script>
<h1>천체 이미지 분석</h1>
<p>천체 이미지 분석 페이지입니다.</p>
{#if imageDataUrl && markedImage && markedImage.height > 0}
<div id="image-info">
<ul>
  <li>이미지 가로: {markedImage.width}</li>
  <li>이미지 세로: {markedImage.height}</li>
  <li> 별 목록
    <ul>
      {#each markedImage.stars as star}
        <li>x: {star.x}, y: {star.y}</li>
      {/each}
    </ul>
  </li>
</div>
{/if}
<div class="container">
  {#if !imageDataUrl}
    <ImageUploader bind:imageDataUrl={imageDataUrl} />
  {:else}
    <StarMarker
      bind:imageDataUrl={imageDataUrl}
      bind:markedImage={markedImage}
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
