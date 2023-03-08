import type { AddTask } from './add-task';
import type { AddTaskRepository } from './add-task-repository';

export class LoadAddTaskUseCase {
  addTaskRepository: AddTaskRepository;

  constructor(addTaskRepository: AddTaskRepository) {
    this.addTaskRepository = addTaskRepository;
  }

  public execute(id: string): AddTask | null {
    return this.addTaskRepository.getAddTask(id);
  }
}
