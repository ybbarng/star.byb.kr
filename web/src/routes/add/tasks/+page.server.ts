import type { PageServerLoad } from './$types'

import { loadAllAddTasksUseCase } from '$lib/server/add'

export const load: PageServerLoad = async () => {
  const addTasks = loadAllAddTasksUseCase.execute()
  return {
    addTasks
  }
};
