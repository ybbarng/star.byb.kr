import json
import os

import pika

from plate_solving.plate_solver import PlateSolver

AMQP = {
  "HOST": os.environ.get('AMQP_HOST'),
  "PORT": os.environ.get('AMQP_PORT'),
  "USERNAME": os.environ.get('AMQP_USERNAME'),
  "PASSWORD": os.environ.get('AMQP_PASSWORD'),
}
URL = 'amqp://{USERNAME}:{PASSWORD}@{HOST}:{PORT}'.format(**AMQP);
CONSUMER_QUEUE = 'request-plate-solving-queue'
PRODUCER_QUEUE = 'response-plate-solving-queue'

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
      self.consume_plate_solving_request(body)
    channel = self.connection.channel()
    channel.queue_declare(queue=CONSUMER_QUEUE, durable=True)
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
  
  def produce_plate_solving_response(self, ticket, result):
    response = {
      'ticket': ticket,
      'response': {
        'points': result
      }
    }
    data = json.dumps(response)
    print('MessageQueueService [->] ' + data)
    self.producer_channel.basic_publish(exchange='', routing_key=PRODUCER_QUEUE, body=data)

  def consume_plate_solving_request(self, message):
    request = json.loads(message)
    self.produce_plate_solving_response(request['ticket'], self.plate_solving(request['request']))

  def plate_solving(self, request):
    return PlateSolver().solve(request)
