import { Battlepass, Quest } from '../../db'

export async function saveQuest(
	battlepass: string,
	daily: boolean,
	source: string,
	type: string,
	channelId: string | null,
	quantity: number,
	points: number,
	maxDaily: number | null,
): Promise<object | null> {
	let bp = await Battlepass.findOne({
		where: {
			chainId: battlepass,
		},
	})
	if (bp == null) {
		return null
	}
	let quest = await Quest.create({
		BattlepassId: bp.id,
		repeat: daily,
		source: source,
		type: type,
		channelId: channelId,
		quantity: quantity,
		points: points,
		maxDaily: maxDaily,
	})
	return {
		battlepass,
		daily: quest.repeat,
		source: quest.source,
		type: quest.type,
		channelId: quest.channelId,
		quantity: quest.quantity,
		points: quest.points,
		maxDaily: quest.maxDaily,
	}
}
