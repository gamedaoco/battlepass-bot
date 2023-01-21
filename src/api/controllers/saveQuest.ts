import { Battlepass, BattlepassParticipant, Quest, QuestProgress } from '../../db'

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
		battlepassId: bp.id,
		repeat: daily,
		source: source,
		type: type,
		channelId: channelId,
		quantity: quantity,
		points: points,
		maxDaily: maxDaily,
	})
	let participants = await BattlepassParticipant.findAll({
		attributes: ['identityId'],
		where: {
			battlepassId: bp.id
		}
	});
	if (participants.length) {
		let newProgress: any[] = []
		participants.map(i => {
			newProgress.push({
				questId: quest.id,
				identityId: i.identityId,
				progress: 0
			})
		})
		await QuestProgress.bulkCreate(newProgress)
	}
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

// todo: fetch all participants from the chain and store them into the BattlepassParticipant model
