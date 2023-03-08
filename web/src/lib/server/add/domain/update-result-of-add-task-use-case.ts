import type { AddTaskRepository } from './add-task-repository';

export class UpdateResultOfAddTaskUseCase {
  addTaskRepository: AddTaskRepository;

  constructor(addTaskRepository: AddTaskRepository) {
    this.addTaskRepository = addTaskRepository;
  }

  public execute(id: string, result: number): string | null {
    const addTask = this.addTaskRepository.getAddTask(id);
    if (addTask == null) {
      throw new Error(`Update AddTask is failed: AddTask is not exist with id: ${id}`)
    }
    addTask.result = result;
    const saved = this.addTaskRepository.saveAddTask(addTask);
    if (saved) {
      return id;
    } else {
      return null;
    }
  }
}
