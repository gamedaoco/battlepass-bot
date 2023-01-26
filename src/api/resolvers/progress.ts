import { Quest, QuestProgress, Battlepass, Identity } from '../../db'


export async function progress(parent: any, args: any, context: any, info: any) {
	let filter: any = {}
	let params: any = {
		where: filter,
		include: []
	}
	const { where } = args;
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
		if (where.battlepassId) {
			params.include.push({
				model: Quest,
				required: true,
				attributes: [],
				where: {
					battlepassId: where.battlepassId
				}
			})
		}
		if (where.battlepassChainId) {
			params.include.push({
				model: Battlepass,
				required: true,
				attributes: [],
				where: {
					chainId: where.battlepassChainId
				}
			})
		}
	}
	let res = await QuestProgress.findAll(params)
	return res
}

export async function progressQuest(parent: any, args: any, context: any, info: any) {
	let res = await Quest.findOne({
		where: {
			id: parent.questId
		}
	})
	return res
}

export async function progressIdentity(parent: any, args: any, context: any, info: any) {
	let res = await Identity.findOne({
		where: {
			id: parent.identityId
		}
	})
	return res
}
