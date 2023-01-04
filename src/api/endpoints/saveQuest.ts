import { Request, Response } from 'express';

import { logger } from '../../logger';
import { Quest, Battlepass } from '../../db';
import { QuestSchema } from '../validations';


export async function saveQuest(request: Request, response: Response) {
	let validation = QuestSchema.validate(request.body);
	if (validation.error != undefined || validation.value === undefined) {
		return response.status(400).send({
			success: false,
			error: validation.error || 'Invalid input'
		});
	}
	let battlepass = await Battlepass.findOne({
		where: {chainId: validation.value.battlepass}
	});
	if (battlepass == null) {
		return response.status(404).send({
			success: false,
			error: 'Battlepass with given chain id not found'
		});
	}
	try {
		let q = validation.value;
		let quest = await Quest.create({
			BattlepassId: battlepass.id,
			repeat: q.daily,
			source: q.source,
			type: q.type,
			channelId: q.channelId,
			quantity: q.quantity,
			points: q.points,
			maxDaily: q.maxDaily
		});
		logger.debug('Created quest');
		return response.status(201).send({
			success: true,
			quest: quest
		});
	} catch (e) {
		logger.error('Failed to store quest %s', e);
		return response.status(500).send({
			success: false,
			error: 'Failed to create quest'
		});
	}
}
