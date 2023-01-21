import { QuestProgress, Battlepass, BattlepassParticipant, Identity } from '../../db'


export async function members(parent: any, args: any, context: any, info: any) {
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
		if (where.identityId) {
			filter.identityId = where.identityId
		}
	}
	let res = await BattlepassParticipant.findAll(params)
	return res
}

export async function memberBattlepass(parent: any, args: any, context: any, info: any) {
	let res = await Battlepass.findOne({
		where: {
			id: parent.battlepassId
		}
	})
	return res
}

export async function memberIdentity(parent: any, args: any, context: any, info: any) {
	let res = await Identity.findOne({
		where: {
			id: parent.identityId
		}
	})
	return res
}

export async function memberProgress(parent: any, args: any, context: any, info: any) {
	let res = await QuestProgress.findAll({
		where: {
			identityId: parent.identityId
		}
	})
}
