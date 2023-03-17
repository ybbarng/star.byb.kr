import type { PageServerLoad } from './$types'

import { loadAllPlateSolvingTasksUseCase } from '$lib/server/plate-solving'

export const load: PageServerLoad = async () => {
  const plateSolvingTasks = loadAllPlateSolvingTasksUseCase.execute()
  return {
    plateSolvingTasks
  }
};
