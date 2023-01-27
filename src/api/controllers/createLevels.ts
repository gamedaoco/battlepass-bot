import { Battlepass, BattlepassLevel } from '../../db'

interface Level {
	name: string | null,
	points: number,
	level: number
}

export async function createLevels(
	battlepass: string,
	levels: Level[]
): Promise<object | null> {
	let bp = await Battlepass.findOne({
		where: {
			chainId: battlepass,
		},
	})
	if (bp == null) {
		return null
	}
	let sortedLevels = levels.sort((l1, l2) => {
		return l1.level - l2.level
	})
	let records = []
	let totalPoints = 0
	for (let level of sortedLevels) {
		totalPoints += level.points
		records.push({
			name: level.name,
			points: level.points,
			level: level.level,
			totalPoints: totalPoints,
			battlepassId: bp.id
		})
	}
	return await BattlepassLevel.bulkCreate(records)
}
