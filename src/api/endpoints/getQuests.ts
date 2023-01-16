import { Request, Response } from 'express'

import { logger } from '../../logger'
import { QuestsSchema } from '../validations'
import { getQuests } from '../controllers'


export async function getQuestsView(request: Request, response: Response) {
	let validation = QuestsSchema.validate(request.query);
	if (validation.error != undefined || validation.value === undefined) {
		return response.status(400).send({
			success: false,
			error: validation.error || 'Invalid input'
		});
	}
	let data = await getQuests(validation.value.battlepass);
	return response.status(200).send({
		success: true,
		quests: data
	});
}
