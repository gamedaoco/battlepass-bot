import { Request, Response } from 'express'

import { logger } from '../../logger'
import { CreateQuestSchema } from '../validations'
import { saveQuest } from '../controllers'

export async function saveQuestView(request: Request, response: Response) {
	let validation = CreateQuestSchema.validate(request.body)
	if (validation.error != undefined || validation.value === undefined) {
		return response.status(400).send({
			success: false,
			error: validation.error || 'Invalid input',
		})
	}
	let q = await saveQuest(
		validation.value.battlepass,
		validation.value.daily,
		validation.value.name,
		validation.value.source,
		validation.value.type,
		validation.value.channelId,
		validation.value.quantity,
		validation.value.points,
		validation.value.maxDaily,
	)
	if (q == null) {
		return response.status(404).send({
			success: false,
			error: 'Battlepass with given chain id not found',
		})
	}
	logger.debug('Created quest')
	return response.status(201).send({
		success: true,
		quest: q,
	})
}
