import { BattlepassReward, Battlepass } from '../../db'


export async function rewards(parent: any, args: any, context: any, info: any) {
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
		if (where.battlepassId) {
			filter.battlepassId = where.battlepassId
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
	let res = await BattlepassReward.findAll(params)
	return res
}

export async function rewardBattlepass(parent: any, args: any, context: any, info: any) {
	let res = Battlepass.findOne({
		where: {
			id: parent.battlepassId
		}
	})
	return res
}
