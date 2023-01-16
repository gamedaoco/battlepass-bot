import { Request, Response } from 'express'

import { logger } from '../../logger'
import { QuestUpdatesSchema } from '../validations'
import { getCompletedQuests } from '../controllers'

export async function getCompletedQuestsView(request: Request, response: Response) {
	let validation = QuestUpdatesSchema.validate(request.query)
	if (validation.error != undefined || validation.value === undefined) {
		return response.status(400).send({
			success: false,
			error: validation.error || 'Invalid input',
		})
	}
	let data = await getCompletedQuests(validation.value.battlepass, validation.value.since, validation.value.address)
	return response.status(200).send({
		success: true,
		quests: data,
	})
}
