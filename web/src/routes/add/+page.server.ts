import { fail } from '@sveltejs/kit';
import type { Actions } from './$types'

import { addUseCase } from '$lib/server/add'

export const actions: Actions = {
  default: async ({ request }) => {
    const data = await request.formData();
    const number1 = data.get('number1');
    const number2 = data.get('number2');
    if (!number1 || !number2) {
      return fail(400, { success:false});
    }
    const ticket = addUseCase.execute(parseInt(number1.toString()), parseInt(number2.toString()));
    return { ticket, success: true }
  }
};
