import type { MessageQueueService } from './message-queue-service';
import type { TicketService } from './ticket-service';
import type { CreateAddTaskUseCase } from './create-add-task-use-case';
import type { UpdateResultOfAddTaskUseCase } from './update-result-of-add-task-use-case';

export class AddUseCase {
  messageQueueService: MessageQueueService;
  ticketService: TicketService;
  createAddTaskUseCase: CreateAddTaskUseCase;
  updateResultOfAddTaskUseCase: UpdateResultOfAddTaskUseCase;

  constructor(messageQueueService: MessageQueueService, ticketService: TicketService,
    createAddTaskUseCase: CreateAddTaskUseCase, updateResultOfAddTaskUseCase: UpdateResultOfAddTaskUseCase) {
    this.createAddTaskUseCase = createAddTaskUseCase;
    this.updateResultOfAddTaskUseCase = updateResultOfAddTaskUseCase;
    this.messageQueueService = messageQueueService;
    this.messageQueueService.registerOnResult((ticket: string, result: number) => {
      console.log('ticket: ' + ticket + ' result: ' + result);
      try {
        this.updateResultOfAddTaskUseCase.execute(ticket, result);
      } catch (error) {
        console.error(error);
      }
    });
    this.ticketService = ticketService;
  }

  public execute(number1: number, number2: number): string {
    const ticket = this.ticketService.issueTicket();
    this.messageQueueService.requestAdd(ticket, number1, number2);
    this.createAddTaskUseCase.execute(ticket, number1, number2);
    return ticket;
  }
}
