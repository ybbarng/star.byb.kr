import type { PageServerLoad } from './$types';

import { loadPlateSolvingTaskUseCase } from '$lib/server/plate-solving';

export const load: PageServerLoad = async ({params}) => {
  const plateSolvingTask = await loadPlateSolvingTaskUseCase.execute(params.id)
  return {
    plateSolvingTask
  }
};
