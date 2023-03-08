import { Client } from 'twitter-api-sdk'

import { config } from '../config'
import { logger } from '../logger'

let client: Client | null

export function getClient(): Client {
	if (client) {
		return client
	}
	if (!config.twitter.bearerToken) {
		throw Error('Twitter api key not configured')
	}
	client = new Client(config.twitter.bearerToken)
	return client
}

export async function getTwitterUserIdsByNames(usernames: string[]): Promise<Map<string, string>> {
	if (usernames.length > 100) {
		throw Error('Usernames must be not more then 100')
	}
	let client = getClient()
	let result = new Map<string, string>()
	try {
		let resp = await client.users.findUsersByUsername({ usernames })
		if (resp.data) {
			resp.data.map((i) => {
				result.set(i.id, i.username)
			})
		} else {
			logger.warn('Received invalid response for users by username twitter api call')
		}
	} catch (error) {
		logger.error('Failed to fetch user ids by names')
		logger.error(error)
	}
	return result
}
