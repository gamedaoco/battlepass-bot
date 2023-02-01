import { Op } from 'sequelize'

import { Identity, DiscordActivity } from '../../db'
import { logger } from '../../logger'

export async function saveIdentity(uuid: string | null, discord: string | null, twitter: string | null, address: string | null) {
	let where = [];
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
			where.push ({ address })
		}
	}
	let identity: any = await Identity.findOne({ where: {[Op.or]: where} })
	let created = identity ? false : true
	let shouldCreateActivity = true
	if (created) {
		let fields: any = { discord, twitter, address }
		if (uuid) {
			fields['uuid'] = uuid
		}
		identity = await Identity.create(fields);
	} else {
		identity.discord = discord
		identity.twitter = twitter
		identity.address = address
		await identity.save()
		if (discord) {
			let existingConnectActivity = await DiscordActivity.findOne({
				attributes: ['id'],
				where: {
					identityId: identity.id,
					activityType: 'connect',
				},
			})
			if (existingConnectActivity) {
				shouldCreateActivity = false
			}
		}
	}
	if (discord && shouldCreateActivity) {
		await DiscordActivity.create({
			identityId: identity.id,
			activityType: 'connect',
			guildId: '',
			channelId: null,
			activityId: '',
		})
		logger.debug('Created discord connect activity for user %s', discord)
	}
	logger.debug('Stored identity')
	return [identity, created]
}
