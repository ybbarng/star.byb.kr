import type { AddTask } from './add-task';
import type { AddTaskRepository } from './add-task-repository';

export class LoadAllAddTasksUseCase {
  addTaskRepository: AddTaskRepository;

  constructor(addTaskRepository: AddTaskRepository) {
    this.addTaskRepository = addTaskRepository;
  }

  public execute(): AddTask[] {
    return this.addTaskRepository.getAllAddTasks();
  }
}
