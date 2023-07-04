import express from 'express'
import cors from 'cors'
import pkg from '../../package.json'

import { config, validateConfigs } from '../config'
import { logger } from '../logger'
import { initDB, sequelize } from '../db'
import { auth } from './tokenAuth'
import { applyApolloServer } from './gql'

export const app = express()
app.use(express.json())
app.use(express.urlencoded({ extended: true }))
app.use(cors())
applyApolloServer(app)
if (config.api.secretKey) {
	logger.debug('Securing API with bearer token')
	app.use(auth)
} else {
	logger.debug('API not secure')
}

async function main() {
	logger.info(`${pkg.name} ${pkg.version}`)
	logger.info('initializing...')
	validateConfigs('api')
	if (!(await initDB())) {
		logger.error('Failed to connect to database.')
		return -1
	}
	await sequelize.sync()
	app.listen(config.api.port, () => logger.info('service available on http://localhost:%s/graphql', config.api.port))
}

main().catch((error) => logger.error(error)) // todo: make it work with tests
