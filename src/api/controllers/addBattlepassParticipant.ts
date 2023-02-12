import { Op } from 'sequelize'

import { logger } from '../../logger'
import { Identity, Battlepass, BattlepassParticipant, DiscordActivity, Quest, QuestProgress } from '../../db'

interface AddParticipantInterface {
	battlepass: string
	identityUuid: string
}

export async function addBattlepassParticipant(data: AddParticipantInterface): Promise<Identity | null> {
	let bp = await Battlepass.findOne({
		where: { chainId: data.battlepass },
	})
	if (!bp) {
		return null
	}
	let existingUser = await Identity.findOne({
		where: { uuid: data.identityUuid },
	})
	if (existingUser === null) {
		return null
	}
	let [_, created] = await BattlepassParticipant.findOrCreate({
		where: {
			identityId: existingUser.id,
			battlepassId: bp.id,
		},
		defaults: {
			premium: false
		}
	})
	if (created) {
		let quests = await Quest.findAll({
			where: { battlepassId: bp.id },
			attributes: ['id'],
		})
		let progress = []
		for (let quest of quests) {
			progress.push({
				identityId: existingUser.id,
				questId: quest.id,
				progress: 0,
			})
		}
		if (progress) {
			await QuestProgress.bulkCreate(progress)
		}
	}
	return existingUser
}
