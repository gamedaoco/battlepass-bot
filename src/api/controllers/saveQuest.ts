import { Battlepass, BattlepassParticipant, Quest, QuestProgress } from '../../db'

export async function saveQuest(
	battlepass: string,
	daily: boolean,
	name: string | null,
	source: string,
	type: string,
	channelId: string | null,
	hashtag: string | null,
	twitterId: string | null,
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
		name,
		source,
		type,
		channelId,
		hashtag,
		twitterId,
		quantity,
		points,
		maxDaily,
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
	return quest
}
