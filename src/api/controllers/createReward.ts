import { Battlepass, BattlepassReward } from '../../db'

export async function createReward(
	battlepass: string,
	cid: string | null,
	name: string | null,
	description: string | null,
	points: number | null,
	level: number | null,
	total: number,
): Promise<object | null> {
	let bp = await Battlepass.findOne({
		where: {
			chainId: battlepass,
		},
	})
	if (bp == null) {
		return null
	}
	let reward = await BattlepassReward.create({
		battlepassId: bp.id,
		cid,
		name,
		description,
		points,
		level,
		total,
		available: total
	})
	return reward
}
