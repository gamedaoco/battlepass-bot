import { Quest, QuestProgress, Battlepass } from '../../db'


export async function quests(parent: any, args: any, context: any, info: any) {
	// console.log(info.fieldNodes[0].selectionSet.selections);
	let filter: any = {}
	let params: any = {
		where: filter
	}
	const { where } = args;
	if (where) {
		if (where.id) {
			filter.id = where.id
		}
		if (where.battlepassId) {
			filter.battlepassId = where.battlepassId
		}
		if (where.source) {
			filter.source = where.source
		}
		if (where.type) {
			filter.type = where.type
		}
		if (where.battlepassChainId) {
			params.include = [{
				model: Battlepass,
				attributes: [],
				where: {
					chainId: where.battlepassChainId
				}
			}]
		}
		if (where.repeat !== undefined && where.repeat !== null) {
			filter.repeat = where.repeat
		}
	}
	let res = await Quest.findAll(params)
	return res
}

export async function questBattlepass(parent: any, args: any, context: any, info: any) {
	let res = await Battlepass.findOne({
		where: {
			id: parent.battlepassId
		}
	})
	return res
}

export async function questProgress(parent: any, args: any, context: any, info: any) {
	let res = await QuestProgress.findAll({
		where: {
			questId: parent.id
		}
	})
	return res
}
