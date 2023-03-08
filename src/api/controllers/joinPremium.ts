import { GraphQLError } from 'graphql'
import { logger } from '../../logger'
import { Identity, Battlepass, BattlepassParticipant, Payment } from '../../db'
import { getQueue } from '../../queue'

interface JoinPremiumInterface {
	battlepass: string
	identityUuid: string
}

export async function joinPremium(data: JoinPremiumInterface) {
	let p: any = await BattlepassParticipant.findOne({
		include: [{
			model: Battlepass,
			required: true,
			where: {
				chainId: data.battlepass
			}
		}, {
			model: Identity,
			required: true,
			where: {
				uuid: data.identityUuid
			}
		}]
	})
	if (!p || !p.Battlepass || !p.Identity) {
		logger.warn('Attempt to claim reward for unknown identity or reward object %s', data)
		throw new GraphQLError('Invalid input', {
			extensions: { code: 'BAD_USER_INPUT', description: 'Participant not found' },
		})
	}
	if (p.premium) {
		throw new GraphQLError('Invalid input', {
			extensions: { code: 'BAD_USER_INPUT', description: 'Already premium' },
		})
	}
	if (!p.Identity.address) {
		throw new GraphQLError('Invalid input', {
			extensions: { code: 'BAD_USER_INPUT', description: 'No address provided' },
		})
	}
	let bp = p.Battlepass
	if (bp.freePasses <= bp.passesClaimed) {
		let payment = await Payment.findOne({
			attributes: ['id'],
			where: {
				participantId: p.id
			}
		})
		if (!payment) {
			throw new GraphQLError('Invalid input', {
				extensions: { code: 'BAD_USER_INPUT', description: 'No payment and free passes left' },
			})
		}
	}
	let queue = getQueue('chain')
	queue.add(
		'claimBattlepass',
		{
			type: 'claimBattlepass',
			participantId: p.id
		},
		{
			jobId: `claimBattlepass-${p.id}`
		}
	)
	queue.add(
		'points',
		{ type: 'points', identityId: p.identityId, battlepassId: p.battlepassId },
		{ jobId: `points-${p.Battlepass.chainId}-${p.identityId}` },
	)
	return p.Identity
}
