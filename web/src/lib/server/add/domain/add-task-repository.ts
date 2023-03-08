import type { AddTask } from "./add-task"

export interface AddTaskRepository {
  getAddTask(id: string): Promise<AddTask | null>
  getAllAddTasks(): Promise<AddTask[]>
  createAddTask(id: string, parameter1: number, parameter2: number): Promise<void>
  updateResultOfAddTask(id: string, result: number): Promise<void>
}
