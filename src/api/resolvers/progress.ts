import { Quest, QuestProgress, Battlepass, Identity, sequelize } from '../../db'

export async function progress(parent: any, args: any, context: any, info: any) {
	let filter: any = {}
	let params: any = {
		attributes: {
			include: [[sequelize.col('Identity.uuid'), 'identityUuid']],
		},
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
		if (where.questId) {
			filter.questId = where.questId
		}
		if (where.identityId) {
			filter.identityId = where.identityId
		}
		if (where.identityUuid) {
			params.include[0].where['uuid'] = where.identityUuid
		}
		if (where.battlepassId) {
			params.include.push({
				model: Quest,
				required: true,
				attributes: [],
				where: {
					battlepassId: where.battlepassId,
				},
				include: []
			})
		}
		if (where.battlepassChainId) {
			if (!where.battlepassId) {
				params.include.push({
					model: Quest,
					required: true,
					attributes: [],
					include: [],
				})
			}
			params.include[1].include.push({
				model: Battlepass,
				required: true,
				attributes: [],
				where: {
					chainId: where.battlepassChainId,
				},
			})
		}
	}
	let res = await QuestProgress.findAll(params)
	return res
	// return res.map(i => {
	// 	i.identityUuid = i.get('identityUuid')
	// })
}

export function progressIdentityUuid(parent: any, args: any, context: any, info: any) {
	return parent.get('identityUuid')
}

export async function progressQuest(parent: any, args: any, context: any, info: any) {
	let res = await Quest.findOne({
		where: {
			id: parent.questId,
		},
	})
	return res
}

export async function progressIdentity(parent: any, args: any, context: any, info: any) {
	let res = await Identity.findOne({
		where: {
			id: parent.identityId,
		},
	})
	return res
}
