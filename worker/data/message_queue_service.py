import json

import pika

URL = 'amqp://ybbarng:passwordybbarng@localhost:5672';
CONSUMER_QUEUE = 'request-add-queue'
PRODUCER_QUEUE = 'response-add-queue'

class MessageQueueService:
  def __init__(self):
    self.connection = self.initialize_connection()
    self.producer_channel = self.initialize_producer()
    self.consumer_channel = self.initialize_consumer()

  def initialize_connection(self):
    print('MessageQueueService is initialized.')
    parameters = pika.URLParameters(URL)
    return pika.BlockingConnection(parameters)
  
  def initialize_consumer(self):
    def on_message(channel, method, properties, body):
      print('MessageQueueService [<-] ' + body.decode('UTF-8'))
      self.consume_add_request(body)
    channel = self.connection.channel()
    channel.basic_consume(queue=CONSUMER_QUEUE, on_message_callback=on_message, auto_ack=True)
    channel.start_consuming()
    return channel

  def initialize_producer(self):
    channel = self.connection.channel()
    channel.queue_declare(queue=PRODUCER_QUEUE, durable=True)
    return channel
  
  def destroy(self):
    print('MessageQueueService is destroyed.')
    self.consumer_channel.stop_consuming()
    self.consumer_channel.close()
    self.producer_channel.close()
    self.connection.close()
  
  def produce_add_response(self, ticket, result):
    response = {
      'ticket': ticket,
      'result': result
    }
    data = json.dumps(response)
    print('MessageQueueService [->] ' + data)
    self.producer_channel.basic_publish(exchange='', routing_key=PRODUCER_QUEUE, body=data)

  def consume_add_request(self, message):
    request = json.loads(message)
    self.produce_add_response(request['ticket'], self.add(request['number1'], request['number2']))

  def add(self, number1, number2):
    return number1 + number2
