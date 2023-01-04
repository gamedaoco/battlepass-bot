import express from 'express';

import { config } from '../config';
import { logger } from '../logger';
import { initDB, sequelize } from '../db';
import { router } from './endpoints';


export const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use('/api', router);


async function main() {
	if (!await initDB()) {
		logger.error('Failed to connect to database.');
		return -1;
	}
	await sequelize.sync();
	app.listen(config.api.port, () => logger.info('Listening on %s port', config.api.port));
}

// main().catch(error => logger.error(error));  // todo: make it work with tests
