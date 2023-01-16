import { ApiPromise } from '@polkadot/api';

import { config, validateConfigs } from '../config'
import { logger } from '../logger'
import { sequelize, initDB, ChainStatus } from '../db'
import { connectToNode, listenNewEvents, getActiveBattlePasses } from './chain'
import { getLastBlockTimestamp, processBattlepasses } from '../indexer/indexer'

async function main() {
	validateConfigs('chain')
	if (!(await initDB())) {
		logger.error('Failed to connect to database.')
		return -1
	}
	await sequelize.sync()
	let [status, created] = await ChainStatus.findOrCreate({ defaults: { blockNumber: 0 }, where: {} })
	let lastBlock = await getLastBlockTimestamp()
	if (lastBlock == null) {
		return -1
	}
	let chainApi: ApiPromise | null
	try {
		chainApi = await connectToNode()
	} catch (error) {
		logger.error(error)
		return -1
	}

	let activeBattlepasses = await getActiveBattlePasses()
	await processBattlepasses(status.blockNumber, lastBlock[0], lastBlock[1], activeBattlepasses)
	await listenNewEvents(chainApi, lastBlock[0], lastBlock[1])
}

main().catch((error) => logger.error(error))
