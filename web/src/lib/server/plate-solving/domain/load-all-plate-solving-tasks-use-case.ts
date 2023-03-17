import type { PlateSolvingTask } from './plate-solving-task';
import type { PlateSolvingTaskRepository } from './plate-solving-task-repository';

export class LoadAllPlateSolvingTasksUseCase {
  plateSolvingTaskRepository: PlateSolvingTaskRepository;

  constructor(plateSolvingTaskRepository: PlateSolvingTaskRepository) {
    this.plateSolvingTaskRepository = plateSolvingTaskRepository;
  }

  public async execute(): Promise<PlateSolvingTask[]> {
    return this.plateSolvingTaskRepository.getAllPlateSolvingTasks();
  }
}
