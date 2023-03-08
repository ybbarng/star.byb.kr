<script>
	/** @type {import('./$types').PageData} */
	export let data;
</script>

<h1>AddTask: {data.addTask.id}</h1>
<ul>
	<li>createdAt: {data.addTask.createdAt}</li>
	<li>resultAt: {data.addTask.resultAt}</li>
	<li>parameter1: {data.addTask.parameter1}</li>
	<li>parameter2: {data.addTask.parameter2}</li>
	<li>result: {data.addTask.result}</li>
</ul>
