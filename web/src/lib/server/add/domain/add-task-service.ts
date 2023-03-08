export class AddTaskService {
	ticketCounter: bigint;

	constructor() {
		this.ticketCounter = 0n;
	}
	issueTicket(): string {
		const ticketNumber = this.ticketCounter;
		this.ticketCounter += 1n;
		return ticketNumber.toString();
	}
}
