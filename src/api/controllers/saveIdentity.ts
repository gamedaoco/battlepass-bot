import { Op } from 'sequelize'

import { Identity, DiscordActivity, TwitterActivity } from '../../db'
import { logger } from '../../logger'

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
	let where = []
	if (data.uuid) {
		where.push({ uuid: data.uuid })
	}
	if (data.discord) {
		where.push({ discord: data.discord })
	} else {
		if (data.twitter) {
			where.push({ twitter: data.twitter })
		}
		if (data.address) {
			where.push({ address: data.address })
		}
	}
	let identity: any = await Identity.findOne({ where: { [Op.or]: where } })
	let created = identity ? false : true
	let createDiscordActivity = true
	let createTwitterActivity = true
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
		identity.discord = data.discord
		identity.twitter = data.twitter
		identity.address = data.address
		identity.name = data.name
		identity.email = data.email
		identity.cid = data.cid
		await identity.save()
		if (data.discord) {
			let discordActivity = await DiscordActivity.findOne({
				attributes: ['id'],
				where: {
					identityId: identity.id,
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
	}
	if (data.discord && createDiscordActivity) {
		await DiscordActivity.create({
			identityId: identity.id,
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
	logger.debug('Stored identity')
	return [identity, created]
}
