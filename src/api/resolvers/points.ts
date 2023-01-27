import { Quest, Battlepass, CompletedQuest, QuestProgress, Identity, sequelize } from '../../db'


export async function points(parent: any, args: any, context: any, info: any) {
	let params: any = {
		where: {},
		attributes: [
			[sequelize.col('Identity.id'), 'identityId'],
			[sequelize.col('Identity.uuid'), 'identityUuid'],
			[sequelize.col('Quest.battlepassId'), 'battlepassId'],
			[sequelize.fn('count', '*'), 'quests'],
			[sequelize.fn('sum', sequelize.col('Quest.points')), 'points'],
		],
		group: ['Identity.id', 'Quest.battlepassId'],
		include: [
			{
				model: Quest,
				required: true,
				where: {},
				attributes: [],
				include: []
			},
			{
				model: Identity,
				required: true,
				where: {},
			}
		],
	}
	const { where } = args
	if (where) {
		if (where.battlepassId) {
			params.include[0].where = {
				battlepassId: where.battlepassId
			}
		}
		if (where.battlepassChainId) {
			params.include[0].include.push({
				model: Battlepass,
				required: true,
				attributes: [],
				where: {
					chainId: where.battlepassChainId
				}
			})
		}
		if (where.identityId) {
			params.include[1].where['id'] = where.identityId
		}
		if (where.identityUuid) {
			params.include[1].where['uuid'] = where.identityUuid
		}
	}
	let res = await CompletedQuest.findAll(params)
	return res.map((r) => {
		return {
			identityId: r.get('identityId'),
			identityId: r.get('identityUuid'),
			battlepassId: r.get('battlepassId'),
			points: r.get('points'),
			quests: r.get('quests')
		}
	})
}

export async function pointIdentity(parent: any, args: any, context: any, info: any) {
	let res = await Identity.findOne({
		where: {
			id: parent.identityId
		}
	})
	return res
}

export async function pointBattlepass(parent: any, args: any, context: any, info: any) {
	let res = await Battlepass.findOne({
		where: {
			id: parent.battlepassId
		}
	})
	return res
}
