import { GraphQLError } from 'graphql'
import { config } from '../../config'
import { logger } from '../../logger'
import { getQueue } from '../../queue'
import { Battlepass, BattlepassParticipant, Payment, Identity } from '../../db'

interface ProcessPaymentInterface {
	securityToken: string
	battlepass: string
	identityUuid: string
	paymentToken: string
}

export async function processPayment(data: ProcessPaymentInterface) {
	if (data.securityToken != config.api.securityToken) {
		throw new GraphQLError('Invalid input', {
			extensions: { code: 'BAD_USER_INPUT', description: 'Invalid security token' },
		})
	}
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
	if (!p) {
		throw new GraphQLError('Invalid input', {
			extensions: { code: 'BAD_USER_INPUT', description: 'Participant not found' },
		})
	}
	if (p.status != 'pendingPayment') {
		throw new GraphQLError('Invalid input', {
			extensions: { code: 'BAD_USER_INPUT', description: `Participant status invalid "${p.status}"` },
		})
	}
	let [payment, created] = await Payment.findOrCreate({
		where: {
			participantId: p.id,
		},
		defaults: {
			paymentToken: data.paymentToken,
			participantId: p.id,
		}
	})
	if (created) {
		p.status = 'pending'
		await p.save()
		logger.info(
			'Received payment for participant %s, battlepass %s, identity %s',
			p.id, p.Battlepass.chainId, p.Identity.uuid
		)
	}
	else {
		logger.info('Received multiple payments for participant %s with data %s', p.id, data)
	}
	let queue = getQueue('chain')
	await queue.add(
		'claimBattlepass',
		{
			type: 'claimBattlepass',
			participantId: p.id
		},
		{ jobId: `claimBattlepass-${p.id}` }
	)
	await queue.add(
		'points',
		{ type: 'points', identityId: p.identityId, battlepassId: p.battlepassId },
		{ jobId: `points-${p.Battlepass.chainId}-${p.identityId}` },
	)
	return {
		battlepass: p.Battlepass.chainId,
		identityUuid: p.Identity.uuid,
		paymentToken: payment.paymentToken,
		status: p.status
	}
}
