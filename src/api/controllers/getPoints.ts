import { Op } from 'sequelize'

import { sequelize, Quest, CompletedQuest, Identity, Battlepass } from '../../db'

export async function getPoints(battlepass: string, since: Date | null, address: string | null) {
	let params: any = {
		attributes: [
			[sequelize.col('Identity.discord'), 'discord'],
			[sequelize.col('Identity.address'), 'address'],
			[sequelize.fn('count', '*'), 'quests'],
			[sequelize.fn('sum', sequelize.col('Quest.points')), 'points'],
		],
		group: ['Identity.id'],
		include: [
			{
				model: Quest,
				required: true,
				attributes: [],
				include: [
					{
						model: Battlepass,
						required: true,
						attributes: [],
						where: {
							chainId: battlepass,
						},
					},
				],
			},
			{
				model: Identity,
				required: true,
				where: address ? { address } : {},
				attributes: [],
			},
		],
	}
	if (since) {
		params['having'] = sequelize.where(sequelize.fn('max', sequelize.col('CompletedQuest.createdAt')), {
			[Op.gte]: since,
		})
	}
	return await CompletedQuest.findAll(params)
}
