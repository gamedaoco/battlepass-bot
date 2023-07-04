import * as crypto from 'crypto'
import { Job } from 'bullmq'
import { Op } from 'sequelize'

import { config } from '../config'
import { logger } from '../logger'
import { getQueue } from '../queue'

import { Identity, GenericActivity, UserToken, Quest, CompletedQuest, QuestProgress, BattlepassParticipant } from '../db'

export async function worker(job: Job) {
	let type = job.data.type
	logger.debug('Received %s task', type)
}

