import { Op } from 'sequelize'

import { config, validateConfigs } from './config'
import { logger } from './logger'
import { BattlepassParticipant, Identity } from './db'
import { getActiveBattlePasses, processBattlepassQuests } from './chain/chain'
import { getBattlepassUsers } from './indexer/indexer'

export async function iteration(again: boolean) {
	const battlepasses = await getActiveBattlePasses()
	if (battlepasses.size) {
		logger.debug('Iteration with %s battlepasses', battlepasses.size)
	} else {
		logger.debug('Iteration')
	}
	for (let [bpId, battlepass] of battlepasses) {
		const chainAddresses = await getBattlepassUsers(bpId)
		const nonChainIdentities = (
			await BattlepassParticipant.findAll({
				where: { BattlepassId: battlepass.id },
				attributes: ['IdentityId'],
			})
		).map((item) => item.IdentityId)
		if ((!chainAddresses || !chainAddresses.length) && !nonChainIdentities.length) {
			// means there are no participants in the battlepass
			continue;
		}
		const battlepassesIdentities = (
			await Identity.findAll({
				where: {
					[Op.or]: [{ address: chainAddresses }, { id: nonChainIdentities }],
				},
				attributes: ['id'],
			})
		).map((item) => item.id)

		if (battlepassesIdentities.length) {
			await processBattlepassQuests(battlepass, battlepassesIdentities)
		}
	}
	if (again) {
		setTimeout(
			async () => {
				await iteration(true)
			},
			config.general.checkFrequency * 1000
		)
	}
}

async function main() {
	validateConfigs('aggregation')
	await iteration(true)
}

main().catch((error) => logger.error(error))
