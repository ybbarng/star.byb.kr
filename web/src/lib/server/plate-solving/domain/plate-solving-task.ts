import type { PlateSolvingTaskRequest } from "./plate-solving-task-request";
import type { PlateSolvingTaskResponse } from "./plate-solving-task-response";

export type PlateSolvingTask = {
  id: string;
  createdAt: Date;
  request: PlateSolvingTaskRequest;
  resultAt: Date | null;
  response: PlateSolvingTaskResponse;
}
