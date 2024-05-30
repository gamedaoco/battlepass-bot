import { Op } from 'sequelize'

import { config, validateConfigs } from './config'
import { logger } from './logger'

import { BattlepassParticipant, Identity } from './db'
import { getActiveBattlePasses, processBattlepassQuests } from './chain/chain'

export async function iteration(again: boolean) {
	const battlepasses = await getActiveBattlePasses()
	if (battlepasses.size) {
		logger.debug('Iteration with %s battlepasses', battlepasses.size)
	} else {
		logger.debug('Iteration')
	}
	for (let [bpId, battlepass] of battlepasses) {
		const identities = await Identity.findAll({
			include: [
				{
					model: BattlepassParticipant,
					where: { battlepassId: battlepass.id },
					attributes: [],
				},
			],
		})
		if (!identities.length) {
			// means there are no participants in the battlepass
			continue
		}
		await processBattlepassQuests(battlepass, identities)
	}
	if (again) {
		setTimeout(async () => {
			await iteration(true)
		}, config.general.checkFrequency * 1000)
	}
}

async function main() {
	validateConfigs('aggregation')
	await iteration(true)
}

main().catch((error) => logger.error(error))
