import { Client } from 'twitter-api-sdk'

import { config } from '../config'

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
