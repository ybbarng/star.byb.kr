import type { PrismaClient } from "@prisma/client";

import type { AddTask } from "../domain/add-task";
import type { AddTaskRepository } from "../domain/add-task-repository";

export class PrismaAddTaskRepository implements AddTaskRepository {
  prisma: PrismaClient
  constructor(prisma: PrismaClient) {
    this.prisma = prisma;
  }

  getAddTask(id: string): AddTask | null {
    return null;
  }

  getAllAddTasks(): AddTask[] {
    return [];
  }

  saveAddTask(addTask: AddTask): boolean {
    return false;
  }
}