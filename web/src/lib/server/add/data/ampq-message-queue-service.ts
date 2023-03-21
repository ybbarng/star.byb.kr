import type {Channel, Connection, ConsumeMessage } from 'amqplib';
import client from 'amqplib';

import type { MessageQueueService } from '../domain/message-queue-service';

class AMPQMessageQueueService implements MessageQueueService {
  URL = `amqp://${process.env.AMQP_USERNAME}:${process.env.AMQP_PASSWORD}@${process.env.AMQP_HOST}:${process.env.AMQP_PORT}`;
  PRODUCER_QUEUE = 'request-add-queue';
  CONSUMER_QUEUE = 'response-add-queue';
  
  connection: Promise<Connection>;
  consumerChannel: Promise<Channel>;
  producerChannel: Promise<Channel>;
  onResult: ((ticket: string, result: number) => void) | null;

  constructor() {
    this.connection = this.initializeConnection();
    this.connection.catch(error => {
      console.error(error);
    });
    this.consumerChannel = this.initializeConsumer();
    this.consumerChannel.catch(error => {
      console.error(error);
    });
    this.producerChannel = this.initializeProducer();
    this.producerChannel.catch(error => {
      console.error(error);
    });
    this.onResult = null;
  }

  async initializeConnection() {
    if (!process.env.AMQP_HOST || !process.env.AMQP_PORT || !process.env.AMQP_USERNAME || !process.env.AMQP_PASSWORD) {
      return Promise.reject("AMQP setting is invalidate.");
    }
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

  registerOnResult(onResult: (ticket: string, result: number) => void): void {
    this.onResult = onResult;
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

  public requestAdd(ticket: string, number1: number, number2: number) {
    this.produceAdd(ticket, number1, number2);
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
      this.onResult(data.ticket, data.result);
    }
    channel.ack(message);
  }
}

export const getMessageQueueService = () => {
 const messageQueueService  = new AMPQMessageQueueService();
  process.on('exit', _ => {
    messageQueueService.destroy();
  });
  return messageQueueService;
}
