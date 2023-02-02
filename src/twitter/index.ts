import { config, validateConfigs } from '../config'
import { logger } from '../logger'
import { TwitterActivity } from '../db'
import { getActiveBattlePasses } from '../chain/chain'
import { sequelize, initDB, Quest, Battlepass } from '../db'
import { getClient } from './client'
import { processTweetQuests } from './tweets'
import { processLikeQuests } from './likes'

async function iteration(again: boolean) {
	const battlepasses = await getActiveBattlePasses()
	if (battlepasses.size) {
		logger.debug('Iteration with %s battlepasses', battlepasses.size)
	} else {
		logger.debug('Iteration')
	}
	let newItems: any[] = []
	for (let [_, battlepass] of battlepasses) {
		let quests = await Quest.findAll({
			where: {
				battlepassId: battlepass.id,
				source: 'twitter',
			},
		})
		if (quests.length) {
			await processTweetQuests(battlepass, quests, newItems)
			await processLikeQuests(battlepass, quests, newItems)
		}
	}
	if (newItems.length) {
		logger.debug('Found %s new twitter acitvities', newItems.length)
		await TwitterActivity.bulkCreate(newItems)
	}
	if (again) {
		setTimeout(async () => {
			await iteration(true)
		}, config.twitter.checkFrequency * 1000)
	}
}

async function main() {
	validateConfigs('twitter')
	if (!(await initDB())) {
		logger.error('Failed to connect to database.')
		return -1
	}
	await sequelize.sync()
	await iteration(true)
}

main().catch((error) => logger.error(error))
