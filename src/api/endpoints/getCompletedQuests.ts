import { Op } from 'sequelize';
import { Request, Response } from 'express';

import { logger } from '../../logger';
import { Quest, CompletedQuest, Battlepass, Identity, sequelize } from '../../db';
import { QuestUpdatesSchema } from '../validations';


export async function getCompletedQuests(request: Request, response: Response) {
	let validation = QuestUpdatesSchema.validate(request.query);
	if (validation.error != undefined || validation.value === undefined) {
		return response.status(400).send({
			success: false,
			error: validation.error || 'Invalid input'
		});
	}
	let q = await CompletedQuest.findAll({
		where: 
			validation.value.since ?
				{
					updatedAt: {
						[Op.gte]: validation.value.since
					}
				} :
				{},
		attributes: [
			['QuestId', 'questId'],
			'Identity.id',
			[sequelize.col('Identity.discord'), 'discord'],
			[sequelize.col('Identity.address'), 'address'],
			[sequelize.fn('count', '*'), 'count'],
			[sequelize.fn('sum', sequelize.col('Quest.points')), 'points'],
		],
		group: [
			'questId', 'Identity.id'
		],
		include: [
			{
				model: Quest,
				required: true,
				attributes: [],
				include: [{
					model: Battlepass,
					required: true,
					attributes: [],
					where: {
						chainId: validation.value.battlepass
					}
				}],
			},
			{
				model: Identity,
				required: true,
				where: 
					validation.value.address ?
					{address: validation.value.address} : 
					{},
				attributes: []
			}
		]
	});
	return response.status(200).send({
		success: true,
		quests: q
	})
}
