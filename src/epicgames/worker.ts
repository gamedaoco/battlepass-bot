import * as crypto from 'crypto';
import { Job } from 'bullmq'
import { Op } from 'sequelize'
import { config } from '../config'
import { logger } from '../logger'
import { getQueue } from '../queue'
import { Identity, GenericActivity, UserToken, Quest, CompletedQuest, QuestProgress } from '../db'

export async function worker(job: Job) {
	let type = job.data.type
	logger.debug('Received %s task', type)
	if (type == 'authCode') {
		await processAuthCode(job.data.identityUuid, job.data.code)
	} else if (type == 'refreshCode') {
		await processRefreshCode(job.data.identityUuid)
	} else {
		logger.error('Received task of uknown type %s', job.data)
	}
}

function basicAuthHeader(clientId: string, clientSecret: string) {
  return `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString("base64")}`
}

async function epicAuth(code: string, isRefresh: boolean) {
	const params: any = {
		grant_type: (isRefresh ? 'refresh_token' : 'authorization_code'),
		deployment_id: config.epicGames.deploymentId,
		scope: 'basic_profile',
  }
  if (isRefresh) {
  	params['refresh_token'] = code
  } else {
  	params['code'] = code
  }
  logger.debug('Auth params %s', params)
  let resp = await fetch(
  	config.epicGames.tokenUri,
  	{
  		method: 'POST',
  		body: new URLSearchParams(params),
		  headers: {
	    	'Content-type': 'application/x-www-form-urlencoded',
    		'Authorization': basicAuthHeader(config.epicGames.clientId, config.epicGames.clientSecret)
    	},
    }
	)
	let json = await resp.json()
	if (!resp.ok) {
		logger.error('Failed to obtain user token')
		logger.error(JSON.stringify(json))
		throw Error('Invalid auth response')
	}
	return json
}

async function processAuthCode(identityUuid: string, code: string) {
	let i = await Identity.findOne({where: { uuid: identityUuid }})
	if (!i) {
		logger.error('Attempt to process auth code for unknown identity %s', identityUuid)
		return
	}
	let resp
	try {
		resp = await epicAuth(code.split('::::')[0], false)
	} catch (e) {
		logger.error('Error during auth token retrieval for %s', identityUuid)
		logger.error(e)
		return
	}
	let userEpicId = resp.account_id
	let expiry = new Date(resp.expires_at)
	if (!userEpicId) {
		logger.error('User response data does not contain account id')
		logger.error(resp)
		return
	}
	if (await Identity.findOne({
		where: {
			id: { [Op.ne]: i.id },
			epicGames: userEpicId
		}
	})) {
		logger.error('Attempt to use same account for multiple identities %s', resp)
		// todo: invalidate token for other user?
		return
	}
	i.epicGames = userEpicId
	await i.save()
	let tokenStr = JSON.stringify(resp)
	let token = await UserToken.findOne({
		where: { source: 'epicGames', identityId: i.id },
	})
	if (token) {
		token.token = tokenStr
		token.expiry = expiry
		await token.save()
	} else {
		await UserToken.create({
			identityId: i.id,
			source: 'epicGames',
			token: tokenStr,
			expiry: expiry
		})
	}
	await GenericActivity.findOrCreate({
		where: {
			source: 'epicGames',
			activityType: 'connect',
			authorId: userEpicId
		},
	})
	logger.info('Stored token for user %s', identityUuid)
	await processConnectQuests(i)
	let queue = await getQueue('epicGames')
	let now = Date.now()
	await queue.add(
		'refreshCode',
		{
			type: 'refreshCode',
			identityUuid,
		},
		{
			jobId: `refreshCode-epicGames-${i.id}-${expiry.valueOf()}`,
			delay: expiry.valueOf() - now - (60 * 1000)
		}
	)
}

async function processRefreshCode(identityUuid: string) {
	let record: any = await UserToken.findOne({
		where: { source: 'epicGames' },
		include: [{
			model: Identity,
			required: true,
			attributes: ['id'],
			where: { uuid: identityUuid }
		}]
	})
	if (!record) {
		logger.error('Attempt to refresh token for non-existing user %s', identityUuid)
		return
	}
	let token = JSON.parse(record.token)
	let resp = await epicAuth(token.refresh_token, true)
	if (resp.expires_at) {
		record.token = JSON.stringify(resp)
		record.expiry = new Date(resp.expires_at)
		await record.save()
		logger.info('Refreshed token for user %s', identityUuid)
	} else {
		logger.error('No expiry provided for refresh token request user %s', identityUuid)
		return
	}
	let now = Date.now()
	let queue = await getQueue('epicGames')
	await queue.add(
		'refreshCode',
		{
			type: 'refreshCode',
			identityUuid,
		},
		{
			jobId: `refreshCode-epicGames-${record.Identity.id}-${record.expiry.valueOf()}`,
			delay: record.expiry.valueOf() - now - (60 * 1000)
		}
	)
}

async function processConnectQuests(i: Identity) {
	let progress = await QuestProgress.findAll({
		where: {
			identityId: i.id,
			progress: 0
		},
		include: [{
			model: Quest,
			required: true,
			where: {
				source: 'epicGames',
				type: 'connect'
			}
		}]
	})
	if (!progress.length) {
		return
	}
	let completedQuests = new Array<any>()
	for (let p of progress) {
		p.progress = 1
		await p.save()
		completedQuests.push({
			identityId: i.id,
			questId: p.questId
		})
	}
	if (completedQuests.length) {
		await CompletedQuest.bulkCreate(completedQuests)
	}
	logger.info('Completing connect epic quests for identity %s', i.uuid)
}
