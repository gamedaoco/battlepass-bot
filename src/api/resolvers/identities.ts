import { QuestProgress, BattlepassParticipant, Identity } from '../../db'


export async function identities(parent: any, args: any, context: any, info: any) {
	let filter: any = {}
	let params: any = {
		where: filter
	}
	const { where } = args;
	if (where) {
		if (where.id) {
			filter.id = where.id
		}
		if (where.address) {
			filter.address = where.address
		}
		if (where.discord) {
			filter.discord = where.discord
		}
		if (where.twitter) {
			filter.twitter = where.twitter
		}
	}
	let res = await Identity.findAll(params)
	return res
}

export async function identityMembers(parent: any, args: any, context: any, info: any) {
	let res = await BattlepassParticipant.findAll({
		where: {
			identityId: parent.id
		}
	})
	return res
}

export async function identityProgress(parent: any, args: any, context: any, info: any) {
	let res = await QuestProgress.findAll({
		where: {
			identityId: parent.id
		}
	})
	return res
}
