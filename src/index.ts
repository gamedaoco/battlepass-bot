import { Op } from 'sequelize';

import { config, validateConfigs } from './config';
import { logger } from './logger';
import { BattlepassParticipant, Identity } from './db';
import { getActiveBattlePasses, processBattlepassQuests } from './chain/chain';
import { getBattlepassUsers } from './indexer/indexer';


async function iteration() {
	const battlepasses = await getActiveBattlePasses();
	if (battlepasses.size) {
		logger.debug('Iteration with %s battlepasses', battlepasses.size);
	} else {
		logger.debug('Iteration');
	}
	for (let [bpId, battlepass] of battlepasses) {
		const users = await getBattlepassUsers(bpId);
		const participantIds = (await BattlepassParticipant.findAll({
			where: {
				BattlepassId: bpId
			},
			attributes: ['IdentityId'],
			include: [{
				model: Identity,
				required: true,
				attributes: [],
				where: {
					address: {
						[Op.is]: null
					}
				}
			}]
		})).map(item => item.IdentityId);
		if(users != null) {
			await processBattlepassQuests(battlepass, users, participantIds);
		}
	}
	setTimeout(iteration, config.general.checkFrequency * 1000);
}

async function main() {
	validateConfigs('aggregation');
	await iteration();
}

main().catch(error => logger.error(error));
