import type { PrismaClient } from "@prisma/client";

import type { AddTask } from "../domain/add-task";
import type { AddTaskRepository } from "../domain/add-task-repository";

export class PrismaAddTaskRepository implements AddTaskRepository {
  prisma: PrismaClient
  constructor(prisma: PrismaClient) {
    this.prisma = prisma;
  }

  async getAddTask(id: string): Promise<AddTask | null> {
    return await this.prisma.addTask.findUnique({
      where: {
        id
      }
    });
  }

  async getAllAddTasks(): Promise<AddTask[]> {
    return await this.prisma.addTask.findMany();
  }

  async createAddTask(id: string, parameter1: number, parameter2: number) {
    await this.prisma.addTask.create({
      data: {
        id,
        parameter1,
        parameter2,
      }
    })
  }

  async updateResultOfAddTask(id: string, result: number) {
    await this.prisma.addTask.update({
      where: {
        id
      },
      data: {
        result,
        resultAt: new Date()
      }
    })
  }
}