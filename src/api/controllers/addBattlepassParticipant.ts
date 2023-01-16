import { Op } from 'sequelize'

import { Identity, Battlepass, BattlepassParticipant } from '../../db'

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
	let record = await BattlepassParticipant.create({
		IdentityId: existingUser.id,
		BattlepassId: bp.id,
	})
	return [existingUser, created]
}
