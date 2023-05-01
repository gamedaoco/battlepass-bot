import { config, validateConfigs } from '../config'
import { logger } from '../logger'
import { sequelize, initDB } from '../db'
import { getWorker } from '../queue'
import { worker } from './worker'

async function main() {
	validateConfigs('epicGames')
	if (!(await initDB())) {
		logger.error('Failed to connect to database.')
		return -1
	}
	await sequelize.sync()
	getWorker('epicGames', worker)
}

main().catch((error) => logger.error(error))
