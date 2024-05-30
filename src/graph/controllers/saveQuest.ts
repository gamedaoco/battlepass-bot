import { GraphQLError } from 'graphql'
import { Battlepass, BattlepassParticipant, Quest, QuestProgress } from '../../db'

interface CreateQuestInterface {
	battlepass: string
	daily: boolean
	name: string | null
	description: string | null
	link: string | null
	cid: string | null
	source: string
	type: string
	guildId: string | null
	channelId: string | null
	hashtag: string | null
	twitterId: string | null
	quantity: number
	points: number
	max: number | null
	maxDaily: number | null
}

export async function saveQuest(data: CreateQuestInterface): Promise<Quest> {
	let bp = await Battlepass.findOne({
		where: {
			chainId: data.battlepass,
		},
	})
	if (bp == null) {
		throw new GraphQLError('Invalid input', {
			extensions: { code: 'BAD_USER_INPUT', description: 'Battlepass not found' },
		})
	}
	if (data.hashtag && data.hashtag.charAt(0) == '#') {
		data.hashtag = data.hashtag.substring(1)
	}
	if (data.twitterId) {
		data.twitterId = data.twitterId.toLowerCase()
	}
	let quest = await Quest.create({
		battlepassId: bp.id,
		repeat: data.daily,
		...data
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
