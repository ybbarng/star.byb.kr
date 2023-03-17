import type { PlateSolvingTask } from "./plate-solving-task"
import type { PlateSolvingTaskRequest } from "./plate-solving-task-request"
import type { PlateSolvingTaskResponse } from "./plate-solving-task-response"

export interface PlateSolvingTaskRepository {
  getPlateSolvingTask(id: string): Promise<PlateSolvingTask | null>
  getAllPlateSolvingTasks(): Promise<PlateSolvingTask[]>
  createPlateSolvingTask(id: string, request: PlateSolvingTaskRequest): Promise<void>
  updateResultOfPlateSolvingTask(id: string, result: PlateSolvingTaskResponse): Promise<void>
}
