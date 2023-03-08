import type { AddTaskRepository } from './add-task-repository';

export class CreateAddTaskUseCase {
  addTaskRepository: AddTaskRepository;

  constructor(addTaskRepository: AddTaskRepository) {
    this.addTaskRepository = addTaskRepository;
  }

  public execute(id: string, parameter1: number, parameter2: number): string | null {
    const saved = this.addTaskRepository.saveAddTask({
      id,
      parameter1,
      parameter2,
      createdAt: null,
      result: null
    });
    if (saved) {
      return id;
    } else {
      return null;
    }
  }
}
