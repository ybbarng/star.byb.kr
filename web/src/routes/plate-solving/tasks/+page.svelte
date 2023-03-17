<script lang="ts">
  import type { PageData } from './$types';

  export var data: PageData;
</script>

<h1>PlateSolvingTasks</h1>
<ul>
  {#each data.plateSolvingTasks as plateSolvingTask}
    <li>
      <ul>
        <li>id: {plateSolvingTask.id}</li>
        <li>createdAt: {plateSolvingTask.createdAt}</li>
        <li>resultAt: {plateSolvingTask.resultAt}</li>
        <li>request: {JSON.stringify(plateSolvingTask.request)}</li>
        <li>response: {JSON.stringify(plateSolvingTask.response)}</li>
      </ul>
    </li>
  {/each}
</ul>
