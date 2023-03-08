import { PrismaClient } from '@prisma/client'

import { dev } from '$app/environment';

import { PrismaAddTaskRepository } from './data/add-task-repository';
import { getMessageQueueService } from './data/ampq-message-queue-service';
import { MockMessageQueueService } from './data/mock-message-queue-service';
import { AddUseCase } from './domain/add-use-case';
import { TicketService } from './domain/ticket-service';
import type { MessageQueueService } from './domain/message-queue-service';
import { LoadAddTaskUseCase } from './domain/load-add-task-use-case';
import { LoadAllAddTasksUseCase } from './domain/load-all-add-tasks-use-case';

const prisma = new PrismaClient();
process.on('exit', _ => {
  prisma.$disconnect();
});

const addTaskRepository = new PrismaAddTaskRepository(prisma);

export const loadAddTaskUseCase = new LoadAddTaskUseCase(addTaskRepository);
export const loadAllAddTasksUseCase = new LoadAllAddTasksUseCase(addTaskRepository);

const buildMessageQueueService = (): MessageQueueService => {
  if (dev) {
    return new MockMessageQueueService();
  } else {
    return getMessageQueueService();
  }
};

export const addUseCase = new AddUseCase(buildMessageQueueService(), new TicketService(), addTaskRepository);