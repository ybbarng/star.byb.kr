import type { AddTask } from "./add-task"

export interface AddTaskRepository {
  getAddTask(id: string): AddTask | null
  getAllAddTasks(): AddTask[]
  saveAddTask(addTask: AddTask): boolean
}
