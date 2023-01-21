import { Op } from 'sequelize'

import { logger } from '../../logger'
import { Identity, Battlepass, BattlepassParticipant, DiscordActivity } from '../../db'

export async function addBattlepassParticipant(
	battlepass: string,
	discord: string | null,
	twitter: string | null,
): Promise<[Identity, boolean] | null> {
	let bp = await Battlepass.findOne({
		where: { chainId: battlepass },
	})
	if (!bp) {
		return null
	}
	let where = []
	if (discord) {
		where.push({ discord })
	}
	if (twitter) {
		where.push({ twitter })
	}
	if (!where.length) {
		return null
	}
	let created = false
	let existingUser = await Identity.findOne({
		where: { [Op.or]: where },
	})
	if (existingUser === null) {
		existingUser = await Identity.create({
			discord,
			twitter,
		})
		created = true
	} else {
		existingUser.twitter = twitter
		existingUser.discord = discord
		await existingUser.save()
	}
	await BattlepassParticipant.findOrCreate({
		where: {
			identityId: existingUser.id,
			battlepassId: bp.id,
		},
	})
	let createActivity = true
	if (!created && discord) {
		let existingActivity = await DiscordActivity.count({
			where: {
				identityId: existingUser.id,
				activityType: 'connect',
			},
		})
		if (existingActivity) {
			createActivity = false
		}
	}
	if (createActivity && discord) {
		await DiscordActivity.create({
			identityId: existingUser.id,
			activityType: 'connect',
			guildId: '',
			channelId: null,
			activityId: '',
		})
		logger.debug('Created discord connect activity for user %s', discord)
	}
	return [existingUser, created]
}
