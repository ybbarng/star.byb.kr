import type { PlateSolvingTask } from './plate-solving-task';
import type { PlateSolvingTaskRepository } from './plate-solving-task-repository';

export class LoadPlateSolvingTaskUseCase {
  plateSolvingTaskRepository: PlateSolvingTaskRepository;

  constructor(plateSolvingTaskRepository: PlateSolvingTaskRepository) {
    this.plateSolvingTaskRepository = plateSolvingTaskRepository;
  }

  public async execute(id: string): Promise<PlateSolvingTask | null> {
    return this.plateSolvingTaskRepository.getPlateSolvingTask(id);
  }
}
