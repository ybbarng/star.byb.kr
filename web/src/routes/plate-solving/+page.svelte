<script lang="ts">
  import ImageUploader from '$lib/plate-solving/component/ImageUploader.svelte';
  import StarMarker from '$lib/plate-solving/component/StarMarker.svelte';
  import type { MarkedImage } from '$lib/plate-solving/value-object/marked-image';
  import type { Star } from '$lib/plate-solving/value-object/star';

  import type { ActionData } from './$types';

  export var form: ActionData;

  var imageDataUrl: string;
  var markedImage: MarkedImage;
  $: width = markedImage ? markedImage.width : null;
  $: height = markedImage ? markedImage.height : null;
  $: stars = markedImage?.stars
    ? JSON.stringify(
        markedImage.stars.map((star: Star) => {
          return [star.x, star.y];
        })
      )
    : null;
</script>

<h1>천체 이미지 분석</h1>
<p>천체 이미지 분석 페이지입니다.</p>
<div class="container">
  {#if !form && !imageDataUrl}
    <ImageUploader bind:imageDataUrl />
  {:else if imageDataUrl}
    <StarMarker bind:imageDataUrl bind:markedImage />
    <form method="POST">
      <input name="width" type="number" bind:value={width} />
      <input name="height" type="number" bind:value={height} />
      <input name="stars" type="text" bind:value={stars} />
      <button>분석 시작하기</button>
    </form>
  {:else if form && form.success}
    <p>
      천체 이미지 분석이 시작되었습니다. 분석 아이디는 <a href="plate-solving/tasks/{form.ticket}"
        >{form.ticket}</a
      > 입니다.
    </p>
  {:else}
    <p>에러가 발생했습니다.</p>
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
