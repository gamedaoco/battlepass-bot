import { Battlepass, BattlepassReward, BattlepassParticipant, Quest } from '../../db'

export async function battlepasses(parent: any, args: any, context: any, info: any) {
	// console.log(info.fieldNodes[0].selectionSet.selections);
	let filter: any = {}
	let params: any = {
		where: filter,
	}
	const { where } = args
	if (where) {
		if (where.id) {
			filter.id = where.id
		}
		if (where.chainId) {
			filter.chainId = where.chainId
		}
		if (where.season) {
			filter.season = where.season
		}
		if (where.orgChainId) {
			filter.orgId = where.orgChainId
		}
		if (where.active !== undefined && where.active !== null) {
			filter.active = where.active
		}
		if (where.finalized !== undefined && where.finalized !== null) {
			filter.finalized = where.finalized
		}
	}
	let res = await Battlepass.findAll(params)
	return res
}

export async function battlepassQuests(parent: any, args: any, context: any, info: any) {
	let res = await Quest.findAll({
		where: {
			battlepassId: parent.id,
		},
	})
	return res
}

export async function battlepassMembers(parent: any, args: any, context: any, info: any) {
	let res = await BattlepassParticipant.findAll({
		where: {
			battlepassId: parent.id,
		},
	})
	return res
}

export async function battlepassRewards(parent: any, args: any, context: any, info: any) {
	let res = await BattlepassReward.findAll({
		where: {
			battlepassId: parent.id,
		},
	})
	return res
}

export function formattedDate(fieldName: string) {
	return function (parent: any, args: any, context: any, info: any) {
		let value = parent[fieldName]
		if (value) {
			return value.toISOString()
		} else {
			return value
		}
	}
}
