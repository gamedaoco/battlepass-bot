import { Op } from 'sequelize'
import { GraphQLError } from 'graphql'
import { decodeAddress, encodeAddress } from '@polkadot/util-crypto';

import { config } from '../../config'
import { logger } from '../../logger'
import { Identity, DiscordActivity, TwitterActivity, ChainActivity } from '../../db'

interface SaveIdentityInterface {
	uuid: string | null
	discord: string | null
	twitter: string | null
	address: string | null
	name: string | null
	email: string | null
	cid: string | null
}

export async function saveIdentity(data: SaveIdentityInterface) {
	if (data.address) {
		try {
			data.address = encodeAddress(decodeAddress(data.address), config.chain.prefix)
		} catch (err) {
			throw new GraphQLError('Invalid input', {
				extensions: { code: 'BAD_USER_INPUT', description: 'Invalid address' },
			})
		}
	}
	let where = []
	if (data.uuid) {
		where.push({ uuid: data.uuid })
	}
	if (data.discord) {
		where.push({ discord: data.discord })
	}
	if (data.twitter) {
		where.push({ twitter: data.twitter })
	}
	if (data.address) {
		where.push({ address: data.address })
	}
	let identities = await Identity.findAll({ where: { [Op.or]: where } })
	if (identities.length > 1) {
		logger.error('Save identity not possible due to multiple records returned %s', where)
		throw new GraphQLError('Invalid input', {
			extensions: { code: 'BAD_USER_INPUT', description: 'Account already assigned' },
		})
	}
	let identity: Identity
	let created = identities.length ? false : true
	let createDiscordActivity = true,
		createTwitterActivity = true,
		createChainActivity = true
	if (created) {
		let fields: any = {
			discord: data.discord,
			twitter: data.twitter,
			address: data.address,
			name: data.name,
			email: data.email,
			cid: data.cid,
		}
		if (data.uuid) {
			fields['uuid'] = data.uuid
		}
		identity = await Identity.create(fields)
	} else {
		identity = identities[0]
		if (data.discord && !identity.discord) {
			identity.discord = data.discord
		}
		if (data.address && !identity.address) {
			identity.address = data.address
		}
		if (data.twitter) {
			identity.twitter = data.twitter
		}
		if (data.name) {
			identity.name = data.name
		}
		if (data.email) {
			identity.email = data.email
		}
		if (data.cid) {
			identity.cid = data.cid
		}
		await identity.save()
		if (data.discord) {
			let discordActivity = await DiscordActivity.findOne({
				attributes: ['id'],
				where: {
					discordId: data.discord,
					activityType: 'connect',
				},
			})
			if (discordActivity) {
				createDiscordActivity = false
			}
		}
		if (data.twitter) {
			let twitterActivity = await TwitterActivity.findOne({
				attributes: ['id'],
				where: {
					authorId: data.twitter,
					activityType: 'connect',
				},
			})
			if (twitterActivity) {
				createTwitterActivity = false
			}
		}
		if (data.address) {
			let chainActivity = await ChainActivity.findOne({
				attributes: ['id'],
				where: {
					address: data.address,
					activityType: 'connect',
				},
			})
			if (chainActivity) {
				createChainActivity = false
			}
		}

	}
	if (data.discord && createDiscordActivity) {
		await DiscordActivity.create({
			discordId: data.discord,
			activityType: 'connect',
			guildId: '',
			channelId: null,
			activityId: '',
		})
		logger.debug('Created discord connect activity for user %s', data.discord)
	}
	if (data.twitter && createTwitterActivity) {
		await TwitterActivity.create({
			activityType: 'connect',
			authorId: data.twitter,
		})
		logger.debug('Created twitter connect activity for user %s', data.twitter)
	}
	if (data.address && createChainActivity) {
		await ChainActivity.create({
			activityType: 'connect',
			address: data.address,
		})
		logger.debug('Created chain connect activity for user %s', data.address)
	}
	logger.debug('Stored identity')
	return [identity, created]
}
