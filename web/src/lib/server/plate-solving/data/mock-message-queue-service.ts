import type { MessageQueueService } from '../domain/message-queue-service';
import type { PlateSolvingTaskRequest } from '../domain/plate-solving-task-request';
import type { PlateSolvingTaskResponse } from '../domain/plate-solving-task-response';

export class MockMessageQueueService implements MessageQueueService {
  ticketCounter: bigint;
  onResponse: ((ticket: string, response: PlateSolvingTaskResponse) => void) | null;

  constructor() {
    this.ticketCounter = 0n;
    this.onResponse = null;
  }

  registerOnResponse(onResponse: (ticket: string, response: PlateSolvingTaskResponse) => void): void {
    this.onResponse = onResponse
  }

  public requestPlateSolving(ticket: string, request: PlateSolvingTaskRequest) {
    this.producePlateSolving(ticket, request);
  }

  private async producePlateSolving(ticket: string, request: PlateSolvingTaskRequest) {
    const message = JSON.stringify({
      ticket,
      request
    });
    console.log(`MockMessageQueueService [->] ${message}`);
    await this.mockWorker(message)
  }

  private async mockWorker(message: string) {
    const sleep = (ms: number) => {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
    const request = JSON.parse(message);
    await sleep(10 * 1000);
    const response = JSON.stringify({
      ticket: request.ticket,
      response: {
        points: [[
          [3, 51, 6.0],
          [-3, 0, 3.7]
        ],
        [
          [5, 51, 6.0],
          [-3, 0, 3.7]
        ],
        [
          [5, 51, 6.0],
          [12, 0, 3.7]
        ],
        [
          [3, 51, 6.0],
          [12, 0, 3.7]
        ]]
      }
    });
    this.consumePlateSolving(response)
  }

  private consumePlateSolving(message: string) {
    console.log(`MockMessageQueueService [<-] ${message.toString()}`);
    if (this.onResponse) {
      const data = JSON.parse(message);
      this.onResponse(data.ticket, data.response);
    }
  }
}
