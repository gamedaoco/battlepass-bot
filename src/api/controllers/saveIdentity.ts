import { Op } from 'sequelize'

import { Identity } from '../../db'
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
	if (!created) {
		identity.discord = discord
		identity.twitter = twitter
		identity.address = address
		await identity.save()
	}
	logger.debug('Stored identity')
	return [identity, created]
}
