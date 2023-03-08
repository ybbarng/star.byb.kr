import { v4 as uuidv4 } from 'uuid';

export class TicketService {

	issueTicket(): string {
		return uuidv4();
	}
}
