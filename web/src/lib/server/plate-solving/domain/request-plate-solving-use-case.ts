import type { MessageQueueService } from './message-queue-service';
import type { TicketService } from './ticket-service';
import type { PlateSolvingTaskRepository } from './plate-solving-task-repository';
import type { PlateSolvingTaskResponse } from './plate-solving-task-response';
import type { PlateSolvingTaskRequest } from './plate-solving-task-request';

export class RequestPlateSolvingUseCase {
  messageQueueService: MessageQueueService;
  ticketService: TicketService;
  plateSolvingTaskRepository: PlateSolvingTaskRepository;

  constructor(messageQueueService: MessageQueueService, ticketService: TicketService,
    plateSolvingTaskRepository: PlateSolvingTaskRepository) {
    this.plateSolvingTaskRepository = plateSolvingTaskRepository;
    this.messageQueueService = messageQueueService;
    this.messageQueueService.registerOnResponse((ticket: string, response: PlateSolvingTaskResponse) => {
      console.log('ticket: ' + ticket + ' response: ' + response);
      this.plateSolvingTaskRepository.updateResultOfPlateSolvingTask(ticket, response)
        .catch((error) => {
          console.error("Error occurred while update the result of plateSolvingTask");
          console.error(error);
        });
    });
    this.ticketService = ticketService;
  }

  public execute(request: PlateSolvingTaskRequest): string {
    const ticket = this.ticketService.issueTicket();
    this.messageQueueService.requestPlateSolving(ticket, request);
    this.plateSolvingTaskRepository.createPlateSolvingTask(ticket, request);
    return ticket;
  }
}
