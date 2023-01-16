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
		validation.value.discord,
		validation.value.twitter,
	)
	if (res !== null) {
		let [identity, created] = res
		return response.status(created ? 201 : 200).send({
			success: true,
			identity,
		})
	} else {
		return response.status(400).send({
			success: false,
		})
	}
}
