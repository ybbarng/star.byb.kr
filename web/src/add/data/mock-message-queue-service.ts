import type { MessageQueueService } from '../domain/message-queue-service';

export class MockMessageQueueService implements MessageQueueService {
  ticketCounter: bigint;
  onResult: ((ticket: string, result: number) => void) | null;

  constructor() {
    this.ticketCounter = 0n;
    this.onResult = null;
  }

  registerOnResult(onResult: (ticket: string, result: number) => void): void {
    this.onResult = onResult
  }

  public requestAdd(ticket: string, number1: number, number2: number) {
    this.produceAdd(ticket, number1, number2);
  }

  private async produceAdd(ticket: string, number1: number, number2: number) {
    const message = JSON.stringify({
      ticket,
      number1,
      number2
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
      result: request.number1 + request.number2
    });
    this.consumeAdd(response)
  }

  private consumeAdd(message: string) {
    console.log(`MockMessageQueueService [<-] ${message.toString()}`);
    if (this.onResult) {
      const data = JSON.parse(message);
      this.onResult(data.ticket, data.result);
    }
  }
}
