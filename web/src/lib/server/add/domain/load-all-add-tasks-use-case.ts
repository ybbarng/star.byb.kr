import type { AddTask } from './add-task';
import type { AddTaskRepository } from './add-task-repository';

export class LoadAllAddTasksUseCase {
  addTaskRepository: AddTaskRepository;

  constructor(addTaskRepository: AddTaskRepository) {
    this.addTaskRepository = addTaskRepository;
  }

  public async execute(): Promise<AddTask[]> {
    return this.addTaskRepository.getAllAddTasks();
  }
}
