import { RewardClaim, Battlepass, BattlepassReward, BattlepassParticipant, Identity } from '../../db'

export async function rewardClaims(parent: any, args: any, context: any, info: any) {
	let filter: any = {}
	let params: any = {
		where: filter,
		include: [],
	}
	const { where } = args
	if (where) {
		if (where.battlepassChainId) {
			params.include.push({
				model: BattlepassReward,
				required: true,
				attributes: [],
				include: [{
					model: Battlepass,
					required: true,
					attributes: [],
					where: {
						chainId: where.battlepassChainId,
					},
				}]
			})
		}
		if (where.identityUuid) {
			params.include.push({
				model: BattlepassParticipant,
				required: true,
				attributes: [],
				include: [{
					model: Identity,
					required: true,
					attributes: [],
					where: {
						uuid: where.identityUuid
					}
				}]
			})
		}
	}
	let res = await RewardClaim.findAll(params)
	return res
}

export async function rewardClaimReward(parent: any, args: any, context: any, info: any) {
	let res = BattlepassReward.findOne({
		where: {
			id: parent.rewardId,
		},
	})
	return res
}

export async function rewardClaimMember(parent: any, args: any, context: any, info: any) {
	let res = BattlepassParticipant.findOne({
		where: {
			id: parent.participantId,
		},
	})
	return res
}
