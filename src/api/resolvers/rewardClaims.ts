import { RewardClaim, Battlepass, BattlepassReward, BattlepassParticipant, Identity } from '../../db'

export async function rewardClaims(parent: any, args: any, context: any, info: any) {
	let filter: any = {}
	let params: any = {
		where: filter,
		include: [{
			model: BattlepassReward,
			required: true,
			attributes: ['chainId'],
			include: [{
				model: Battlepass,
				required: true,
				attributes: [],
			}]
		}, {
			model: BattlepassParticipant,
			required: true,
			include: [{
				model: Identity,
				required: true,
				attributes: ['uuid'],
			}]
		}],
	}
	const { where } = args
	if (where) {
		if (where.battlepassChainId) {
			params.include[0].include[0].where = { chainId: where.battlepassChainId }
		}
		if (where.identityUuid) {
			params.include[1].include[0].where = { uuid: where.identityUuid }
		}
	}
	let res: any[] = await RewardClaim.findAll(params)
	return res.map(i => {
		return {
			rewardChainId: i.BattlepassReward.chainId,
			identityUuid: i.BattlepassParticipant.Identity.uuid,
			id: i.id,
			nftId: i.nftId,
			participantId: i.participantId,
			rewardId: i.rewardId,
			syncStatus: i.syncStatus
		}
	})
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
