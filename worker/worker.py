import sys

from add.message_queue_service import MessageQueueService as AddMessageQueueService
from plate_solving.message_queue_service import MessageQueueService as PlateSolvingMessageQueueService


if __name__ == '__main__':
  worker = sys.argv[1]
  message_queue_service = None
  message_queue_services = {
    'add': AddMessageQueueService,
    'plate-solving': PlateSolvingMessageQueueService
  }
  try:
    message_queue_service = message_queue_services[worker]()
  except KeyboardInterrupt:
    if message_queue_service is not None:
      message_queue_service.destroy()
