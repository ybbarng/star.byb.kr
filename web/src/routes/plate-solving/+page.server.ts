import { fail } from '@sveltejs/kit';
import type { Actions } from './$types'

import { requestPlateSolvingUseCase } from '$lib/server/plate-solving'

export const actions: Actions = {
  default: async ({ request }) => {
    const data = await request.formData();
    const width = data.get('width')?.toString();
    const height = data.get('height')?.toString();
    const starsRaw = data.get('stars')?.toString();
    if (!width || !height || !starsRaw) {
      return fail(400, { success:false});
    }
    const stars = JSON.parse(starsRaw);
    if (!stars || stars.length == 0) {
      return fail(400, { success:false});
    }
    const ticket = requestPlateSolvingUseCase.execute({
      width: parseInt(width),
      height: parseInt(height),
      stars
    });
    return { ticket, success: true }
  }
};
