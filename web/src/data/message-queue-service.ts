import type {Channel, Connection, ConsumeMessage } from 'amqplib';
import client from 'amqplib';

class MessageQueueService {
  URL = `amqp://${process.env.AMQP_USERNAME}:${process.env.AMQP_PASSWORD}@${process.env.AMQP_HOST}:${process.env.AMQP_PORT}`;
  PRODUCER_QUEUE = 'request-add-queue';
  CONSUMER_QUEUE = 'response-add-queue';
  
  connection: Promise<Connection>;
  consumerChannel: Promise<Channel>;
  producerChannel: Promise<Channel>;
  ticketCounter: bigint;
  onResult: ((result: number) => void) | null;

  constructor() {
    this.connection = this.initializeConnection();
    this.consumerChannel = this.initializeConsumer();
    this.producerChannel = this.initializeProducer();
    this.ticketCounter = 0n;
    this.onResult = null;
  }

  async initializeConnection() {
    console.log(`MessageQueueService is initialized.`);
    return client.connect(this.URL);
  }

  async initializeConsumer() {
    const connection = await this.connection;
    const channel = await connection.createChannel();
    await channel.assertQueue(this.CONSUMER_QUEUE);
    await channel.consume(this.CONSUMER_QUEUE, (message) => {
      this.consumeAdd(channel, message);
    });
    return channel;
  }

  async initializeProducer() {
    const connection = await this.connection;
    const channel = await connection.createChannel();
    await channel.assertQueue(this.PRODUCER_QUEUE);
    return channel;
  }

  destroy() {
    console.log(`MessageQueueService is destroyed.`);
    const closeConsumer = this.consumerChannel.then((channel: Channel) => {
      channel.close();
    });
    const closeProducer = this.consumerChannel.then((channel: Channel) => {
      channel.close();
    });
    Promise.all([this.connection, closeConsumer, closeProducer]).then(([connection, ...rest]) => {
      connection.close();
    });
  }

  public requestAdd(number1: number, number2: number, onResult: (result: number) => void): string {
    this.onResult = onResult;
    const ticket = this.issueTicket();
    this.produceAdd(ticket, number1, number2);
    return ticket;
  }

  private async produceAdd(ticket: string, number1: number, number2: number) {
    const channel = await this.producerChannel;
    const message = JSON.stringify({
      ticket,
      number1,
      number2
    });
    console.log(`MessageQueueService [->] ${message}`);
    channel.sendToQueue(this.PRODUCER_QUEUE, Buffer.from(message));
  }

  private consumeAdd(channel: Channel, message: ConsumeMessage | null) {
    if (message == null) {
      return;
    }
    console.log(`MessageQueueService [<-] ${message.content.toString()}`);
    if (this.onResult) {
      const data = JSON.parse(message.content.toString());
      this.onResult(data.result);
    }
    channel.ack(message);
  }

  private issueTicket(): string {
    const ticketNumber = this.ticketCounter;
    this.ticketCounter += 1n;
    return ticketNumber.toString()
  }
}

const messageQueueService = new MessageQueueService();

process.on('exit', _ => {
  messageQueueService.destroy();
});

export const requestAdd = function(number1: number, number2: number, onResult: (result: number) => void): string {
  return messageQueueService.requestAdd(number1, number2, onResult);
};
