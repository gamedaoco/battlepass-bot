import * as crypto from 'crypto';
import { Job } from 'bullmq'
import { Op } from 'sequelize'
import { Client, auth } from 'twitter-api-sdk'
import { config } from '../config'
import { logger } from '../logger'
import { getQueue } from '../queue'
import { Identity, TwitterActivity, UserToken } from '../db'

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

function processTokenResponse(token: any): any {
	try {
		const { expires_in, ...rest } = token
		return {
			...rest,
			...(!!expires_in && {
			  expires_at: Date.now() + expires_in * 1000,
			}),
		}
	} catch (e) {
		logger.error('Response does not contain expiration time')
		return
	}
}

async function twitterAuth(authCode: string, verifier: string, redirectUri: string | null) {
	const params = {
      code: authCode,
      grant_type: "authorization_code",
      code_verifier: verifier,
      client_id: config.twitter.clientId,
      redirect_uri: redirectUri || config.twitter.redirectUri,
    }
    logger.debug('Twitter auth params %s', params)
    const url = 'https://api.twitter.com/2/oauth2/token'
    let resp = await fetch(
    	url + '?' + new URLSearchParams(params),
    	{
    		method: 'POST',
			headers: {
		    	'Content-type': 'application/x-www-form-urlencoded',
	    		'Authorization': basicAuthHeader(config.twitter.clientId, config.twitter.clientSecret)
	    	},
	    }
	)
	let json = await resp.json()
	if (!resp.ok) {
		logger.error('Failed to obtain twitter token')
		logger.error(JSON.stringify(json))
		throw Error('Invalid twitter auth response')
	}
	return json
}

async function processAuthCode(identityUuid: string, code: string) {
	let i = await Identity.findOne({where: { uuid: identityUuid }})
	if (!i) {
		logger.error('Attempt to process twitter code for unknown identity %s', identityUuid)
		return
	}
	let verifier = crypto.createHash('sha256').update(i.uuid || '').digest('hex')
	let parts = code.split('::::')
	let resp
	try {
		resp = await twitterAuth(parts[0], verifier, parts.length > 1 ? parts[1] : null)
	} catch (e) {
		logger.error('Error during twitter auth token retrieval for %s', identityUuid)
		logger.error(e)
		return
	}
	let tokenData = processTokenResponse(resp)
	if (!tokenData) {
		logger.error(resp)
		return
	}
	let authCli = new auth.OAuth2User({
		client_id: config.twitter.clientId,
		client_secret: config.twitter.clientSecret,
		callback: config.twitter.redirectUri,
		scopes: ['follows.read', 'offline.access', 'like.read', 'users.read', 'tweet.read']
	})
	authCli.token = tokenData
	let client = new Client(authCli)
	let userData
	try {
		userData = await client.users.findMyUser()
	} catch (e) {
		logger.error('Failed to fetch user details')
		logger.error(e)
		return
	}
	if (!userData || ! userData.data) {
		logger.error('Empty user data received %s', userData)
		return
	}
	if (await Identity.findOne({
		where: {
			id: { [Op.ne]: i.id },
			twitter: userData.data.id
		}
	})) {
		logger.error('Attempt to use same twitter account for multiple identities %s', userData)
		// todo: invalidate token for other user?
		return
	}
	// todo: store identity name from twitter?
	i.twitter = userData.data.id
	await i.save()
	let tokenStr = JSON.stringify(tokenData)
	let token = await UserToken.findOne({
		where: { source: 'twitter', identityId: i.id },
	})
	if (token) {
		token.token = tokenStr
		await token.save()
	} else {
		await UserToken.create({
			identityId: i.id,
			source: 'twitter',
			token: tokenStr
		})
	}
	await TwitterActivity.findOrCreate({
		where: {
			activityType: 'connect',
			authorId: userData.data.id
		},
	})
	logger.info('Stored twitter token for user %s', identityUuid)
	let queue = await getQueue('twitter')
	let now = Date.now()
	await queue.add(
		'refreshCode',
		{
			type: 'refreshCode',
			identityUuid,
		},
		{
			jobId: `refreshCode-twitter-${i.id}`,
			delay: tokenData.expires_at - now - (60 * 1000)
		}
	)
}

async function processRefreshCode(identityUuid: string) {
	let record: any = await UserToken.findOne({
		where: { source: 'twitter' },
		include: [{
			model: Identity,
			required: true,
			attributes: ['id'],
			where: { uuid: identityUuid }
		}]
	})
	if (!record) {
		logger.error('Attempt to refresh token for non-existing twitter user %s', identityUuid)
		return
	}
	let authCli = new auth.OAuth2User({
		client_id: config.twitter.clientId,
		client_secret: config.twitter.clientSecret,
		callback: config.twitter.redirectUri,
		scopes: ['follows.read', 'offline.access', 'like.read', 'users.read', 'tweet.read']
	})
	authCli.token = JSON.parse(record.token)
	let newToken
	try {
		newToken = await authCli.refreshAccessToken()
	} catch (e: any) {
		logger.error('Error during token refresh for user %s', identityUuid)
		logger.error(e)
		return
	}
	if (!newToken || !newToken.token) {
		logger.error('Failed to refresh token for %s', identityUuid)
		return
	}
	if (newToken.token.expires_at) {
		record.token = JSON.stringify(newToken.token)
		record.expiry = new Date(newToken.token.expires_at)
		await record.save()
		logger.info('Refreshed token for user %s', identityUuid)
	} else {
		logger.error('No expiry provided for refresh token request user %s', identityUuid)
		return
	}
	let queue = await getQueue('twitter')
	let now = Date.now()
	await queue.add(
		'refreshCode',
		{
			type: 'refreshCode',
			identityUuid,
		},
		{
			jobId: `refreshCode-twitter-${record.Identity.id}`,
			delay: newToken.token.expires_at - now - (60 * 1000)
		}
	)
}
