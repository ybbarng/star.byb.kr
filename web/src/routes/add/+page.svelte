<script lang="ts">
	import type { ActionData } from './$types';

	export var form: ActionData;
</script>

<h1>Try Add to test the system</h1>
<form method="POST">
	{#if form?.success}
		Your form has been submitted successfully. Your Ticket ID:
		<a href="add/tasks/{form.ticket}">{form.ticket}</a>
	{:else}
		<input type="number" name="number1" /> + <input type="number" name="number2" />
		<button>=</button>
	{/if}
</form>
