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
	let bp = p.Battlepass
	if (!p || !bp || !p.Identity) {
		logger.warn('Attempt to claim reward for unknown identity or reward object %s', data)
		throw new GraphQLError('Invalid input', {
			extensions: { code: 'BAD_USER_INPUT', description: 'Participant not found' },
		})
	}
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
	return p.Identity
}