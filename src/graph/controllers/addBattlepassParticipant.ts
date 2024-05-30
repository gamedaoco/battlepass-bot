import { Op } from 'sequelize'
import { GraphQLError } from 'graphql'

import { logger } from '../../logger'
import { Identity, Battlepass, BattlepassParticipant, DiscordActivity, Quest, QuestProgress } from '../../db'

interface AddParticipantInterface {
	battlepass: string
	identityUuid: string
}

export async function addBattlepassParticipant(data: AddParticipantInterface): Promise<BattlepassParticipant | null> {
	let bp = await Battlepass.findOne({
		where: { chainId: data.battlepass },
	})
	if (!bp) {
		return null
	}
	if (!bp.joinable) {
		throw new GraphQLError('Invalid input', {
			extensions: { code: 'BAD_USER_INPUT', description: 'Battlepass is not joinable' },
		})
	}
	let existingUser = await Identity.findOne({
		where: { uuid: data.identityUuid },
	})
	if (existingUser === null) {
		return null
	}
	let [p, created] = await BattlepassParticipant.findOrCreate({
		where: {
			identityId: existingUser.id,
			battlepassId: bp.id,
		},
		defaults: {
			premium: false
		}
	})
	if (created) {
		await Battlepass.increment(
			{ totalJoined: 1 },
			{ where: { id: bp.id } }
		)
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
	return p
}
