import type { MessageQueueService } from './message-queue-service';
import type { TicketService } from './ticket-service';
import type { AddTaskRepository } from './add-task-repository';

export class AddUseCase {
  messageQueueService: MessageQueueService;
  ticketService: TicketService;
  addTaskRepository: AddTaskRepository;

  constructor(messageQueueService: MessageQueueService, ticketService: TicketService,
    addTaskRepository: AddTaskRepository) {
    this.addTaskRepository = addTaskRepository;
    this.messageQueueService = messageQueueService;
    this.messageQueueService.registerOnResult((ticket: string, result: number) => {
      console.log('ticket: ' + ticket + ' result: ' + result);
      this.addTaskRepository.updateResultOfAddTask(ticket, result)
        .catch((error) => {
          console.error("Error occurred while update the result of AddTask");
          console.error(error);
        });
    });
    this.ticketService = ticketService;
  }

  public execute(number1: number, number2: number): string {
    const ticket = this.ticketService.issueTicket();
    this.messageQueueService.requestAdd(ticket, number1, number2);
    this.addTaskRepository.createAddTask(ticket, number1, number2);
    return ticket;
  }
}
