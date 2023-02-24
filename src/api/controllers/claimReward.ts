import { GraphQLError } from 'graphql'
import { logger } from '../../logger'
import { Identity, BattlepassReward, BattlepassParticipant, RewardClaim } from '../../db'
import { getQueue } from '../../queue'

interface ClaimRewardInterface {
	identityUuid: string
	reward: string
}

export async function claimReward(data: ClaimRewardInterface) {
	let participant: any = await BattlepassParticipant.findOne({
		include: [{
			model: Identity,
			required: true,
			where: {
				uuid: data.identityUuid
			}
		}]
	})
	let reward = await BattlepassReward.findOne({
		where: {
			chainId: data.reward
		}
	})
	if (!participant || !reward) {
		logger.warn('Attempt to claim reward for unknown participant or reward object %s', data)
		throw new GraphQLError('Invalid input', {
			extensions: { code: 'BAD_USER_INPUT', description: 'Invalid participant or reward' },
		})
	}
	if (!reward.available) {
		logger.warn('Attempt to claim not available reward %s', data)
		throw new GraphQLError('Invalid input', {
			extensions: { code: 'BAD_USER_INPUT', description: 'Reward not available' },
		})
	}
	let pendingClaim = await RewardClaim.count({
		where: {
			participantId: participant.id,
			rewardId: reward.id,
			syncStatus: ['pending', 'synced']
		}
	})
	if (pendingClaim) {
		logger.warn(
			'Attempt to claim same reward multiple times for participant %s and reward %s',
			participant.id, data.reward
		)
		throw new GraphQLError('Invalid input', {
			extensions: { code: 'BAD_USER_INPUT', description: 'Reward already claimed' },
		})
	}
	let claim = await RewardClaim.create({
		participantId: participant.id,
		rewardId: reward.id,
	})
	let queue = getQueue('chain')
	queue.add(
		'claimReward',
		{
			type: 'claimReward',
			rewardClaimId: claim.id
		},
		{
			jobId: `claimReward-${participant.id}-${claim.id}`
		}
	)
	return claim
}
