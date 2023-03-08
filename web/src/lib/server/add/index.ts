import { dev } from '$app/environment';

import { getMessageQueueService } from './data/ampq-message-queue-service';
import { MockMessageQueueService } from './data/mock-message-queue-service';
import { AddUseCase } from './domain/add-use-case';
import { TicketService } from './domain/ticket-service';
import type { MessageQueueService } from './domain/message-queue-service';

const buildMessageQueueService = (): MessageQueueService => {
  if (dev) {
    return new MockMessageQueueService();
  } else {
    return getMessageQueueService();
  }
};

export const addUseCase = new AddUseCase(buildMessageQueueService(), new TicketService());