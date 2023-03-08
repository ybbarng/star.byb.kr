import type { MessageQueueService } from './message-queue-service';
import type { TicketService } from './ticket-service';
export class AddUseCase {
  #messageQueueService: MessageQueueService;
  #ticketService: TicketService;

  constructor(messageQueueService: MessageQueueService, ticketService: TicketService) {
    this.#messageQueueService = messageQueueService;
    this.#messageQueueService.registerOnResult((ticket: string, result: number) => {
      console.log('ticket: ' + ticket + ' result: ' + result);
    });
    this.#ticketService = ticketService;
  }

  public execute(number1: number, number2: number): string {
    const ticket = this.#ticketService.issueTicket();
    this.#messageQueueService.requestAdd(ticket, number1, number2);
    return ticket;
  }
}
