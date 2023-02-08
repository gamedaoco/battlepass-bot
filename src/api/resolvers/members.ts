import { QuestProgress, Battlepass, BattlepassParticipant, Identity, Quest, CompletedQuest, sequelize } from '../../db'

export async function members(parent: any, args: any, context: any, info: any) {
	let filter: any = {}
	let params: any = {
		where: filter,
		include: [
			{
				model: Identity,
				required: true,
				attributes: [],
				where: {},
			},
		],
	}
	const { where } = args
	if (where) {
		if (where.id) {
			filter.id = where.id
		}
		if (where.battlepassId) {
			filter.battlepassId = where.battlepassId
		}
		if (where.identityId) {
			filter.identityId = where.identityId
		}
		if (where.identityUuid) {
			params.include[0].where['uuid'] = where.identityUuid
		}
	}
	let res = await BattlepassParticipant.findAll(params)
	return res
}

export async function memberBattlepass(parent: any, args: any, context: any, info: any) {
	let res = await Battlepass.findOne({
		where: {
			id: parent.battlepassId,
		},
	})
	return res
}

export async function memberIdentity(parent: any, args: any, context: any, info: any) {
	let res = await Identity.findOne({
		where: {
			id: parent.identityId,
		},
	})
	return res
}

export async function memberProgress(parent: any, args: any, context: any, info: any) {
	let res = await QuestProgress.findAll({
		where: {
			identityId: parent.identityId,
		},
	})
	return res
}

export async function memberPoints(parent: any, args: any, context: any, info: any) {
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
				where: {
					id: parent.id
				}
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
