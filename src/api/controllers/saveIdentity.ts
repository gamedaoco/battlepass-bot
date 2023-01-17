import { Op } from 'sequelize'

import { Identity, DiscordActivity } from '../../db'
import { logger } from '../../logger'

export async function saveIdentity(discord: string | null, twitter: string | null, address: string | null) {
	let orClause = []
	if (discord) {
		orClause.push({ discord })
	}
	if (twitter) {
		orClause.push({ twitter })
	}
	if (address) {
		orClause.push({ address })
	}
	let [identity, created] = await Identity.findOrCreate({
		where: {
			[Op.or]: orClause,
		},
		defaults: { discord, twitter, address },
	})
	let shouldCreateActivity = true
	if (!created) {
		identity.discord = discord
		identity.twitter = twitter
		identity.address = address
		await identity.save()
		if (discord) {
			let existingConnectActivity = await DiscordActivity.findOne({
				attributes: ['id'],
				where: {
					IdentityId: identity.id,
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
			IdentityId: identity.id,
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
