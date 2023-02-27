<script>
	/** @type {import('./$types').PageData} */
	export let data;
	/** @type {import('./$types').ActionData} */
	export let form;
</script>

<h1>Try Add to test the system</h1>
<form method="POST">
	{#if form?.success}
		Your form has been submitted successfully. Your Ticket ID: ${form.ticket}
	{:else}
		<input type="number" name="number1" /> + <input type="number" name="number2" />
		<button>=</button>
	{/if}
</form>
