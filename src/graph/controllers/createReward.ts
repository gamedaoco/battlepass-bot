import { getQueue } from '../../queue'
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
		available: data.total,
		...data
	})
	let queue = getQueue('chain')
	await queue.add(
		'reward',
		{ type: 'reward', rewardId: reward.id },
		{ jobId: `reward-${data.battlepass}-${reward.id}` }
	)
	return reward
}
