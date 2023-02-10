import { Quest, Battlepass } from '../../db'

export async function getQuests(battlepass: string) {
	const quests = await Quest.findAll({
		include: [
			{
				model: Battlepass,
				required: true,
				attributes: [],
				where: {
					chainId: battlepass,
				},
			},
		],
	})
	return quests.map((quest) => {
		return {
			battlepass,
			daily: quest.repeat,
			source: quest.source,
			type: quest.type,
			channelId: quest.channelId,
			hashtag: quest.hashtag,
			twitterId: quest.twitterId,
			quantity: quest.quantity,
			points: quest.points,
			maxDaily: quest.maxDaily,
		}
	})
}
