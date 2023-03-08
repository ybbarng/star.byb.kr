<script lang="ts">
	import type { PageData } from './$types';

	export var data: PageData;
</script>

<h1>AddTasks</h1>
<ul>
	{#each data.addTasks as addTask}
		<li>
			<ul>
				<li>id: {addTask.id}</li>
				<li>createdAt: {addTask.createdAt}</li>
				<li>resultAt: {addTask.resultAt}</li>
				<li>parameter1: {addTask.parameter1}</li>
				<li>parameter2: {addTask.parameter2}</li>
				<li>result: {addTask.result}</li>
			</ul>
		</li>
	{/each}
</ul>
