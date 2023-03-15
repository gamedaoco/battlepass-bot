import { GraphQLError } from 'graphql'
import { logger } from '../../logger'
import { Identity, UserToken, sequelize } from '../../db'

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
	let existingToken = await UserToken.findOne({ where: { identityId: identity.id, source: data.source }})
	if (existingToken) {
		existingToken.token = data.token
		await existingToken.save()
	} else {
		await UserToken.create({
			identityId: identity.id,
			...data
		})
	}
	return identity
}
