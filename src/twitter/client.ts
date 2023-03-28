import { Client, auth } from 'twitter-api-sdk'

import { config } from '../config'
import { logger } from '../logger'
import { UserToken, sequelize } from '../db'

let client: RotatingClient | null

export function getClient(): RotatingClient {
	if (client) {
		return client
	}
	client = new RotatingClient()
	return client
}

export async function apiWrapper(call: Promise<any>) {
	try {
		return await call
	} finally {
		let changed = client?.isTokenChanged()
		if (changed) {
			let item = client?.currentItem
			if (item) {
				logger.info('Twitter user token updated for %s user', item.identityId || '0')
				let cli = item.token
				if (cli instanceof auth.OAuth2User && cli.token) {
					let token = JSON.stringify(cli.token)
					await UserToken.update(
						{ token },
						{ where: { identityId: item.identityId, source: 'twitter' }, limit: 1}
					)
				}
			}
		}
	}
}

export async function getTwitterUserIdsByNames(usernames: string[]): Promise<Map<string, string>> {
	if (usernames.length > 100) {
		throw Error('Usernames must be not more then 100')
	}
	let client = getClient().getNextClient()
	let result = new Map<string, string>()
	try {
		let resp = await apiWrapper(client.users.findUsersByUsername({ usernames }))
		if (resp.data) {
			resp.data.map((i: any) => {
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


interface Token {
	expires_at: number
}

interface ClientAccessItem {
	token: auth.OAuth2User | string
	identityId?: number
}


class RotatingClient {
	public currentItem: ClientAccessItem
	private currentIndex: number = 0
	private items: Array<ClientAccessItem>
	private expiries: Array<number>

	constructor() {
		this.items = new Array<ClientAccessItem>()
		let item = { token: config.twitter.bearerToken }
		this.items.push(item)
		this.currentItem = item
		this.expiries = new Array<number>()
		this.expiries.push(0)
	}
	getNextClient(): Client {
		this.currentIndex += 1
		if (this.currentIndex >= this.items.length) {
			this.currentIndex = 0
		}
		let client = new Client(this.items[this.currentIndex].token)
		return client
	}
	addToken(token: Token, identityId: number) {
		let authCli = new auth.OAuth2User({
			client_id: config.twitter.clientId,
			client_secret: config.twitter.clientSecret,
			callback: config.twitter.redirectUri,
			scopes: ['follows.read', 'offline.access', 'like.read', 'users.read', 'tweet.read']
		})
		authCli.token = token
		this.items.push({ token: authCli, identityId })
		this.expiries.push(token.expires_at)
	}
	isTokenChanged(): boolean {
		let cli = this.currentItem.token
		if (cli instanceof auth.OAuth2User) {
			let expiry = cli.token?.expires_at
			if (expiry) {
				return expiry != this.expiries[this.currentIndex]
			}
		}
		return false
	}
	reset() {
		this.currentIndex = 0
		this.currentItem = this.items[0]
	}
	async populateTokens() {
		this.items.length = 0
		this.expiries.length = 0
		let tokens = await UserToken.findAll({
			where: {
				source: 'twitter'
			},
			attributes: ['identityId', 'token'],
			order: sequelize.literal('RANDOM()')
		})
		for (let record of tokens) {
			let token = JSON.parse(record.token)
			this.addToken(token, record.identityId)
		}
		this.items.push({ token: config.twitter.bearerToken })
		this.currentIndex = 0
		this.currentItem = this.items[this.currentIndex]
		this.expiries.push(0)
	}
	get size() {
		return this.items.length
	}
	get waitTime() {
		return Math.max(config.twitter.checkFrequency - (this.items.length - 1) * 30, 30)
	}
}
