<script lang="ts">
	import { page } from '$app/stores';
	import type { PageData } from './$types';

	export var data: PageData;
	export const id = $page.params.id;
</script>

{#if data.addTask}
	<h1>AddTask: {data.addTask.id}</h1>
	<ul>
		<li>createdAt: {data.addTask.createdAt}</li>
		<li>resultAt: {data.addTask.resultAt}</li>
		<li>parameter1: {data.addTask.parameter1}</li>
		<li>parameter2: {data.addTask.parameter2}</li>
		<li>result: {data.addTask.result}</li>
	</ul>
{:else}
	<h1>AddTask with {id} is not found.</h1>
{/if}
