import { Op } from 'sequelize'

import { Identity, DiscordActivity, TwitterActivity } from '../../db'
import { logger } from '../../logger'

export async function saveIdentity(
	uuid: string | null,
	discord: string | null,
	twitter: string | null,
	address: string | null,
) {
	let where = []
	if (uuid) {
		where.push({ uuid })
	}
	if (discord) {
		where.push({ discord })
	} else {
		if (twitter) {
			where.push({ twitter })
		}
		if (address) {
			where.push({ address })
		}
	}
	let identity: any = await Identity.findOne({ where: { [Op.or]: where } })
	let created = identity ? false : true
	let createDiscordActivity = true
	let createTwitterActivity = true
	if (created) {
		let fields: any = { discord, twitter, address }
		if (uuid) {
			fields['uuid'] = uuid
		}
		identity = await Identity.create(fields)
	} else {
		identity.discord = discord
		identity.twitter = twitter
		identity.address = address
		await identity.save()
		if (discord) {
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
		if (twitter) {
			let twitterActivity = await TwitterActivity.findOne({
				attributes: ['id'],
				where: {
					authorId: twitter,
					activityType: 'connect',
				},
			})
			if (twitterActivity) {
				createTwitterActivity = false
			}
		}
	}
	if (discord && createDiscordActivity) {
		await DiscordActivity.create({
			identityId: identity.id,
			activityType: 'connect',
			guildId: '',
			channelId: null,
			activityId: '',
		})
		logger.debug('Created discord connect activity for user %s', discord)
	}
	if (twitter && createTwitterActivity) {
		await TwitterActivity.create({
			activityType: 'connect',
			authorId: twitter,
		})
		logger.debug('Created twitter connect activity for user %s', twitter)
	}
	logger.debug('Stored identity')
	return [identity, created]
}
