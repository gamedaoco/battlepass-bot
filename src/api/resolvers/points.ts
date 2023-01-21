import { Quest, Battlepass, CompletedQuest, QuestProgress, Identity, sequelize } from '../../db'


export async function points(parent: any, args: any, context: any, info: any) {
	let params: any = {
		where: {},
		group: ['Quest.battlepassId', 'identityId'],
		attributes: [
			[sequelize.col('identityId'), 'identityId'],
			[sequelize.col('Quest.battlepassId'), 'battlepassId'],
			[sequelize.fn('sum', sequelize.cast(sequelize.col("progress"), 'integer')), 'points'],
		],
		include: [
			{
				model: Quest,
				required: true,
				attributes: [],
			}
		]
	}
	const { where } = args;
	if (where) {
		if (where.battlepassId) {
			params.include[0].where = {
				battlepassId: where.battlepassId
			}
		}
		if (where.identityId) {
			params.where['identityId'] = where.identityId
		}
	}
	let res = await QuestProgress.findAll(params)
	return JSON.parse(JSON.stringify(res)) // todo: resolve issue with accessing custom query fields
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
