import express from 'express';

import { config, validateConfigs } from '../config';
import { logger } from '../logger';
import { initDB, sequelize } from '../db';
import { router } from './endpoints';
import { auth } from './tokenAuth';
import { applyApolloServer } from './gql';


export const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
applyApolloServer(app);
if (config.api.secretKey) {
	logger.debug('Securing API with bearer token');
	app.use(auth);
} else {
	logger.debug('API not secure');
}
app.use('/api', router);


async function main() {
	validateConfigs('api');
	if (!await initDB()) {
		logger.error('Failed to connect to database.');
		return -1;
	}
	await sequelize.sync();
	app.listen(config.api.port, () => logger.info('Listening on %s port', config.api.port));
}

// main().catch(error => logger.error(error));  // todo: make it work with tests
