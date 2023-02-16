import { Battlepass, BattlepassLevel } from '../../db'

interface LevelInterface {
	name: string | null
	points: number
	level: number
}

interface CreateLevelsInterface {
	battlepass: string
	levels: LevelInterface[]
}

export async function createLevels(data: CreateLevelsInterface): Promise<BattlepassLevel[] | null> {
	let bp = await Battlepass.findOne({
		where: {
			chainId: data.battlepass,
		},
	})
	if (bp == null) {
		return null
	}
	let sortedLevels = data.levels.sort((l1, l2) => {
		return l1.level - l2.level
	})
	let records = []
	let totalPoints = 0
	for (let level of sortedLevels) {
		totalPoints += level.points
		records.push({
			battlepassId: bp.id,
			totalPoints: totalPoints,
			...level
		})
	}
	return await BattlepassLevel.bulkCreate(records)
}
