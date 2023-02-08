import { Quest, Battlepass, BattlepassParticipant, CompletedQuest, QuestProgress, Identity, sequelize } from '../../db'

export async function points(parent: any, args: any, context: any, info: any) {
	let params: any = {
		where: {},
		attributes: [
			[sequelize.col('Identity.id'), 'identityId'],
			[sequelize.col('Identity.uuid'), 'identityUuid'],
			[sequelize.col('Quest.battlepassId'), 'battlepassId'],
			[sequelize.fn('sum', sequelize.cast(sequelize.col('QuestProgress.progress'), 'integer')), 'quests'],
			[sequelize.fn('sum', sequelize.literal('CAST("QuestProgress"."progress" AS INTEGER) * "Quest"."points"')), 'points'],

		],
		group: ['Identity.id', 'Quest.battlepassId'],
		include: [
			{
				model: Identity,
				required: true,
				attributes: [],
				where: {}
			},
			{
				model: Quest,
				required: true,
				attributes: [],
				where: {},
				include: [{
					model: Battlepass,
					required: true,
					attributes: [],
					where: {}
				}]
			}
		]
	}
	const { where } = args
	if (where) {
		if (where.battlepassId) {
			params.include[1].where['battlepassId'] = where.battlepassId
		}
		if (where.battlepassChainId) {
			params.include[1].include[0].where['chainId'] = where.battlepassChainId
		}
		if (where.identityId) {
			params.include[0].where['id'] = where.identityId
		}
		if (where.identityUuid) {
			params.include[0].where['uuid'] = where.identityUuid
		}
	}
	let res = await QuestProgress.findAll(params)
	return res.map((r) => {
		return {
			identityId: r.get('identityId'),
			identityUuid: r.get('identityUuid'),
			battlepassId: r.get('battlepassId'),
			points: r.get('points'),
			quests: r.get('quests'),
		}
	})
}

export async function pointIdentity(parent: any, args: any, context: any, info: any) {
	let res = await Identity.findOne({
		where: {
			id: parent.identityId,
		},
	})
	return res
}

export async function pointBattlepass(parent: any, args: any, context: any, info: any) {
	let res = await Battlepass.findOne({
		where: {
			id: parent.battlepassId,
		},
	})
	return res
}
