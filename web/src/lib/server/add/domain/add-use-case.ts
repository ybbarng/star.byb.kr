import type { MessageQueueService } from './message-queue-service';
import type { AddTaskService } from './add-task-service';
export class AddUseCase {
  addTaskService: AddTaskService;
  messageQueueService: MessageQueueService;

  constructor(addTaskService: AddTaskService, messageQueueService: MessageQueueService) {
    this.addTaskService = addTaskService;
    this.messageQueueService = messageQueueService;
    this.messageQueueService.registerOnResult((ticket: string, result: number) => {
      console.log('ticket: ' + ticket + ' result: ' + result);
    });
  }

  public execute(number1: number, number2: number): string {
    const ticket = this.addTaskService.issueTicket();
    this.messageQueueService.requestAdd(ticket, number1, number2);
    return ticket;
  }
}
