import type {Channel, Connection, ConsumeMessage } from 'amqplib';
import client from 'amqplib';

import type { MessageQueueService } from '../domain/message-queue-service';
import type { PlateSolvingTaskRequest } from '../domain/plate-solving-task-request';
import type { PlateSolvingTaskResponse } from '../domain/plate-solving-task-response';

class AMPQMessageQueueService implements MessageQueueService {
  URL = `amqp://${process.env.AMQP_USERNAME}:${process.env.AMQP_PASSWORD}@${process.env.AMQP_HOST}:${process.env.AMQP_PORT}`;
  PRODUCER_QUEUE = 'request-plate-solving-queue';
  CONSUMER_QUEUE = 'response-plate-solving-queue';
  
  connection: Promise<Connection>;
  consumerChannel: Promise<Channel>;
  producerChannel: Promise<Channel>;
  ticketCounter: bigint;
  onResponse: ((ticket: string, response: PlateSolvingTaskResponse) => void) | null;

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
    this.ticketCounter = 0n;
    this.onResponse = null;
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
      this.consumePlateSolving(channel, message);
    });
    return channel;
  }

  async initializeProducer() {
    const connection = await this.connection;
    const channel = await connection.createChannel();
    await channel.assertQueue(this.PRODUCER_QUEUE);
    return channel;
  }

  registerOnResponse(onResponse: (ticket: string, response: PlateSolvingTaskResponse) => void): void {
    this.onResponse = onResponse;
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

  public requestPlateSolving(ticket: string, request: PlateSolvingTaskRequest) {
    this.producePlateSolving(ticket, request);
  }

  private async producePlateSolving(ticket: string, request: PlateSolvingTaskRequest) {
    const channel = await this.producerChannel;
    const message = JSON.stringify({
      ticket,
      request
    });
    console.log(`MessageQueueService [->] ${message}`);
    channel.sendToQueue(this.PRODUCER_QUEUE, Buffer.from(message));
  }

  private consumePlateSolving(channel: Channel, message: ConsumeMessage | null) {
    if (message == null) {
      return;
    }
    console.log(`MessageQueueService [<-] ${message.content.toString()}`);
    if (this.onResponse) {
      const data = JSON.parse(message.content.toString());
      this.onResponse(data.ticket, data.response);
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
