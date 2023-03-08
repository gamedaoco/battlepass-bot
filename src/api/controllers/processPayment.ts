import { GraphQLError } from 'graphql'
import { config } from '../../config'
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
	let p = await BattlepassParticipant.findOne({
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
	let [payment, created] = await Payment.findOrCreate({
		where: {
			paymentToken: data.paymentToken,
			participantId: p.id,
		},
	})
	return {
		battlepass: data.battlepass,
		identityUuid: data.identityUuid,
		paymentToken: data.paymentToken
	}
}
