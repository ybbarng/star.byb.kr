import { fail } from '@sveltejs/kit';
import type { Actions } from './$types'
import { add } from '../data/backend-service'

export const actions: Actions = {
  default: async ({ request }) => {
    const data = await request.formData();
    const number1 = data.get('number1');
    const number2 = data.get('number2');
    if (!number1 || !number2) {
      return fail(400, { success:false});
    }
    const result = add(parseInt(number1.toString()), parseInt(number2.toString()));
    return { result, success: true }
  }
};
