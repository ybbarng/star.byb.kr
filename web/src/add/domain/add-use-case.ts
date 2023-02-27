import type { MessageQueueService } from './message-queue-service';

export class AddUseCase {
  messageQueueService: MessageQueueService;
  ticketCounter: bigint;

  constructor(messageQueueService: MessageQueueService) {
    this.messageQueueService = messageQueueService;
    this.messageQueueService.registerOnResult((ticket: string, result: number) => {
      console.log("ticket: " + ticket + " result: " + result);
    })
    this.ticketCounter = 0n;
  }

  public execute(number1: number, number2: number): string {
    const ticket = this.issueTicket();
    this.messageQueueService.requestAdd(ticket, number1, number2);
    return ticket;
  }

  private issueTicket(): string {
    const ticketNumber = this.ticketCounter;
    this.ticketCounter += 1n;
    return ticketNumber.toString()
  }
}
