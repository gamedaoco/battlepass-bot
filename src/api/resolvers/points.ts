import { Quest, Battlepass, CompletedQuest, QuestProgress, Identity, sequelize } from '../../db'


export async function points(parent: any, args: any, context: any, info: any) {
	let params: any = {
		where: {},
		attributes: [
			[sequelize.col('CompletedQuest.identityId'), 'identityId'],
			[sequelize.col('Quest.battlepassId'), 'battlepassId'],
			[sequelize.fn('count', '*'), 'quests'],
			[sequelize.fn('sum', sequelize.col('Quest.points')), 'points'],
		],
		group: ['CompletedQuest.identityId', 'Quest.battlepassId'],
		include: [
			{
				model: Quest,
				required: true,
				where: {},
				attributes: [],
				include: []
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
			params.where['identityId'] = where.identityId
		}
	}
	let res = await CompletedQuest.findAll(params)
	return res.map((r) => {
		return {
			identityId: r.get('identityId'),
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
