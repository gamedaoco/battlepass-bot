import { Request, Response } from 'express'

import { logger } from '../../logger'
import { AddParticipantSchema } from '../validations'
import { addBattlepassParticipant } from '../controllers'

export async function addBattlepassParticipantView(request: Request, response: Response) {
	let validation = AddParticipantSchema.validate(request.body)
	if (validation.error != undefined || validation.value === undefined) {
		return response.status(400).send({
			success: false,
			error: validation.error || 'Invalid input',
		})
	}
	let res = await addBattlepassParticipant(
		validation.value.battlepass,
		validation.value.identityUuid,
	)
	if (res !== null) {
		return response.status(200).send({
			success: true,
			identity: res,
		})
	} else {
		return response.status(400).send({
			success: false,
		})
	}
}
