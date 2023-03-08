import type { PageServerLoad } from './$types'

import { loadAddTaskUseCase } from '$lib/server/add'

export const load: PageServerLoad = async ({params}) => {
  const addTask = loadAddTaskUseCase.execute(params.id)
  return {
    addTask
  }
};
