export interface MessageQueueService {
  registerOnResult(onResult: (ticket: string, result: number) => void): void
  requestAdd(ticket: string, number1: number, number2: number): void
}
