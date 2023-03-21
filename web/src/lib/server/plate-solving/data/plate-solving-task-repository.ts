import type { PrismaClient } from "@prisma/client";

import type { PlateSolvingTask } from "../domain/plate-solving-task";
import type { PlateSolvingTaskRepository } from "../domain/plate-solving-task-repository";
import type { PlateSolvingTaskRequest } from "../domain/plate-solving-task-request";
import type { PlateSolvingTaskResponse } from "../domain/plate-solving-task-response";

export class PrismaPlateSolvingTaskRepository implements PlateSolvingTaskRepository {
  prisma: PrismaClient
  constructor(prisma: PrismaClient) {
    this.prisma = prisma;
  }

  async getPlateSolvingTask(id: string): Promise<PlateSolvingTask | null> {
    const plateSolvingTask = await this.prisma.plateSolvingTask.findUnique({
      where: {
        id
      }
    })
    if (plateSolvingTask) {
      plateSolvingTask.request = JSON.parse(plateSolvingTask.request);
      plateSolvingTask.response = JSON.parse(plateSolvingTask.response);
    }
    return plateSolvingTask;
  }

  async getAllPlateSolvingTasks(): Promise<PlateSolvingTask[]> {
    const plateSolvingTasks = await this.prisma.plateSolvingTask.findMany();
    return plateSolvingTasks.map((plateSolvingTaskEntry) => {
      return {
        ...plateSolvingTaskEntry,
        request: JSON.parse(plateSolvingTaskEntry.request),
        response: JSON.parse(plateSolvingTaskEntry.response)
      }
    });
  }

  async createPlateSolvingTask(id: string, request: PlateSolvingTaskRequest) {
    await this.prisma.plateSolvingTask.create({
      data: {
        id,
        request: JSON.stringify(request)
      }
    })
  }

  async updateResultOfPlateSolvingTask(id: string, result: PlateSolvingTaskResponse) {
    await this.prisma.plateSolvingTask.update({
      where: {
        id
      },
      data: {
        response: JSON.stringify(result),
        resultAt: new Date()
      }
    })
  }
}
