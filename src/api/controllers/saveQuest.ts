import { Battlepass, BattlepassParticipant, Quest, QuestProgress } from '../../db'

interface CreateQuestInterface {
	battlepass: string
	daily: boolean
	name: string | null
	description: string | null
	cid: string | null
	source: string
	type: string
	guildId: string | null
	channelId: string | null
	hashtag: string | null
	twitterId: string | null
	quantity: number
	points: number
	maxDaily: number | null
}

export async function saveQuest(data: CreateQuestInterface): Promise<Quest | null> {
	let bp = await Battlepass.findOne({
		where: {
			chainId: data.battlepass,
		},
	})
	if (bp == null) {
		return null
	}
	let quest = await Quest.create({
		battlepassId: bp.id,
		repeat: data.daily,
		name: data.name,
		description: data.description,
		cid: data.cid,
		source: data.source,
		type: data.type,
		guildId: data.guildId,
		channelId: data.channelId,
		hashtag: data.hashtag,
		twitterId: data.twitterId,
		quantity: data.quantity,
		points: data.points,
		maxDaily: data.maxDaily,
	})
	let participants = await BattlepassParticipant.findAll({
		attributes: ['identityId'],
		where: {
			battlepassId: bp.id,
		},
	})
	if (participants.length) {
		let newProgress: any[] = []
		participants.map((i) => {
			newProgress.push({
				questId: quest.id,
				identityId: i.identityId,
				progress: 0,
			})
		})
		await QuestProgress.bulkCreate(newProgress)
	}
	return quest
}
