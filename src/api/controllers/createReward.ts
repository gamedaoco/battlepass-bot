import { Battlepass, BattlepassReward } from '../../db'

interface CreateRewardInterface {
	battlepass: string
	name: string | null
	description: string | null
	cid: string | null
	points: number | null
	level: number | null
	total: number
}

export async function createReward(data: CreateRewardInterface): Promise<BattlepassReward | null> {
	let bp = await Battlepass.findOne({
		where: {
			chainId: data.battlepass,
		},
	})
	if (bp == null) {
		return null
	}
	let reward = await BattlepassReward.create({
		battlepassId: bp.id,
		cid: data.cid,
		name: data.name,
		description: data.description,
		points: data.points,
		level: data.level,
		total: data.total,
		available: data.total,
	})
	return reward
}
