<script>
	/** @type {import('./$types').PageData} */
	export let data;
	/** @type {import('./$types').ActionData} */
	export let form;
</script>

<h1>Find the stars in pictures</h1>
<form method="POST">
	<input type="number" name="number1" /> + <input type="number" name="number2" /> <button>=</button>
	{#if form?.success}
		{form.ticket}
	{/if}
</form>
