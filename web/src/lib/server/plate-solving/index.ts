import { PrismaClient } from '@prisma/client'

import { dev } from '$app/environment';

import { PrismaPlateSolvingTaskRepository } from './data/plate-solving-task-repository';
import { getMessageQueueService } from './data/ampq-message-queue-service';
import { MockMessageQueueService } from './data/mock-message-queue-service';
import { RequestPlateSolvingUseCase } from './domain/request-plate-solving-use-case';
import { TicketService } from './domain/ticket-service';
import type { MessageQueueService } from './domain/message-queue-service';
import { LoadPlateSolvingTaskUseCase } from './domain/load-plate-solving-task-use-case';
import { LoadAllPlateSolvingTasksUseCase } from './domain/load-all-plate-solving-tasks-use-case';

const prisma = new PrismaClient();
process.on('exit', _ => {
  prisma.$disconnect();
});

const addTaskRepository = new PrismaPlateSolvingTaskRepository(prisma);

export const loadPlateSolvingTaskUseCase = new LoadPlateSolvingTaskUseCase(addTaskRepository);
export const loadAllPlateSolvingTasksUseCase = new LoadAllPlateSolvingTasksUseCase(addTaskRepository);

const buildMessageQueueService = (): MessageQueueService => {
  if (dev) {
    return new MockMessageQueueService();
  } else {
    return getMessageQueueService();
  }
};

export const requestPlateSolvingUseCase = new RequestPlateSolvingUseCase(
  buildMessageQueueService(), new TicketService(), addTaskRepository
);
