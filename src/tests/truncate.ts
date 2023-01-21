import { Battlepass, DiscordActivity, Identity, Quest, ChainStatus, CompletedQuest, BattlepassParticipant, QuestProgress } from '../db'

export default async function truncate() {
	return await Promise.all(
		[Battlepass, DiscordActivity, Identity, Quest, ChainStatus, CompletedQuest, BattlepassParticipant, QuestProgress].map((model: any) => {
			model.destroy({ where: {}, force: true })
		}),
	)
}
