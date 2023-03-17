import type { PlateSolvingTaskRequest } from "./plate-solving-task-request"
import type { PlateSolvingTaskResponse } from "./plate-solving-task-response"

export interface MessageQueueService {
  registerOnResponse(onResult: (ticket: string, response: PlateSolvingTaskResponse) => void): void
  requestPlateSolving(ticket: string, request: PlateSolvingTaskRequest): void
}
