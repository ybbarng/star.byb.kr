<script lang="ts">
  import { page } from '$app/stores';
  import type { PageData } from './$types';

  import CelestialMap from '$lib/plate-solving/component/CelestialMap.svelte';

  export var data: PageData;
  export const id = $page.params.id;
</script>

{#if data.plateSolvingTask}
  <h1>PlateSolvingTask: {data.plateSolvingTask.id}</h1>
  <ul>
    <li>createdAt: {data.plateSolvingTask.createdAt}</li>
    <li>resultAt: {data.plateSolvingTask.resultAt}</li>
    <li>request: {JSON.stringify(data.plateSolvingTask.request)}</li>
    <li>response: {JSON.stringify(data.plateSolvingTask.response)}</li>
  </ul>
  {#if data.plateSolvingTask.response}
    <div class="container">
      <CelestialMap bind:quadrilateralPoints={data.plateSolvingTask.response.points} />
    </div>
  {/if}
{:else}
  <h1>PlateSolvingTask with {id} is not found.</h1>
{/if}
