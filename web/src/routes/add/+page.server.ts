import { fail } from '@sveltejs/kit';
import { dev } from '$app/environment';
import type { Actions } from './$types'

import { getMessageQueueService } from '../../add/data/ampq-message-queue-service'
import { MockMessageQueueService } from '../../add/data/mock-message-queue-service'
import { AddUseCase } from '../../add/domain/add-use-case'
import type { MessageQueueService } from '../../add/domain/message-queue-service';

const buildMessageQueueService = (): MessageQueueService => {
  if (dev) {
    return new MockMessageQueueService();
  } else {
    return getMessageQueueService();
  }
}

const addUseCase = new AddUseCase(buildMessageQueueService())

export const actions: Actions = {
  default: async ({ request }) => {
    const data = await request.formData();
    const number1 = data.get('number1');
    const number2 = data.get('number2');
    if (!number1 || !number2) {
      return fail(400, { success:false});
    }
    const ticket = addUseCase.execute(parseInt(number1.toString()), parseInt(number2.toString()));
    return { ticket, success: true }
  }
};
