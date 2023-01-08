import { Op } from 'sequelize';
import { Request, Response } from 'express';

import { logger } from '../../logger';
import { Quest, CompletedQuest, Battlepass, Identity, sequelize } from '../../db';
import { PointUpdatesSchema } from '../validations';


export async function getPoints(request: Request, response: Response) {
	let validation = PointUpdatesSchema.validate(request.query);
	if (validation.error != undefined || validation.value === undefined) {
		return response.status(400).send({
			success: false,
			error: validation.error || 'Invalid input'
		});
	}
	let q = await CompletedQuest.findAll({
		attributes: [
			[sequelize.col('Identity.discord'), 'discord'],
			[sequelize.col('Identity.address'), 'address'],
			[sequelize.fn('count', '*'), 'quests'],
			[sequelize.fn('sum', sequelize.col('Quest.points')), 'points'],
		],
		group: ['Identity.id'],
		having: 
			validation.value.since ? 
			sequelize.where(
				sequelize.fn('max', sequelize.col('CompletedQuest.createdAt')), {
					[Op.gte]: validation.value.since
				}
			) : 
			[],
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
		points: q
	})
}
