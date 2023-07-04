import pkg from '../../package.json'
import { config, validateConfigs } from '../config'
import { logger } from '../logger'

import { sequelize, initDB } from '../db'
import { getWorker } from '../queue'
import { worker } from './worker'

async function main() {
	logger.info(`${pkg.name} ${pkg.version}`)
	logger.info('initializing...')
	validateConfigs('gamedao')
	if (!(await initDB())) {
		logger.error('Failed to connect to database.')
		return -1
	}
	await sequelize.sync()
	getWorker('gamedao', worker)
}

main().catch((error) => logger.error(error))
