from add.message_queue_service import MessageQueueService


if __name__ == '__main__':
  message_queue_service = None
  try:
    message_queue_service = MessageQueueService()
  except KeyboardInterrupt:
    if message_queue_service is not None:
      message_queue_service.destroy()
