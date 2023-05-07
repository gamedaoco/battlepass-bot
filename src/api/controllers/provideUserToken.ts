import { GraphQLError } from 'graphql'
import { logger } from '../../logger'
import { Identity, UserToken, sequelize } from '../../db'
import { getQueue } from '../../queue'

interface UserTokenInterface {
	identityUuid: string
	source: string
	token: string
}

export async function provideUserToken(data: UserTokenInterface): Promise<Identity | null> {
	let identity = await Identity.findOne({ where: { uuid: data.identityUuid }})
	if (!identity) {
		throw new GraphQLError('Invalid input', {
			extensions: { code: 'BAD_USER_INPUT', description: 'Identity does not exist' },
		})
	}
	if (data.source == 'twitter') {
		let queue = getQueue('twitter')
		await queue.add(
			'authCode',
			{
				type: 'authCode',
				identityUuid: data.identityUuid,
				code: data.token
			},
			{
				jobId: `authCode-${data.source}-${identity.id}`
			}
		)
	} else if (data.source == 'epicGames') {
		let queue = getQueue('epicGames')
		await queue.add(
			'authCode',
			{
				type: 'authCode',
				identityUuid: data.identityUuid,
				code: data.token
			},
			{
				jobId: `authCode-${data.source}-${identity.id}`
			}
		)
	} else {
		logger.error('Received token for unknown source %s', data)
	}
	return identity
}
