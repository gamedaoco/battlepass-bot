import * as crypto from 'crypto';
import { Job } from 'bullmq'
import { config } from '../config'
import { logger } from '../logger'
import { Identity, UserToken } from '../db'

export async function worker(job: Job) {
	let type = job.data.type
	logger.debug('Received %s task', type)
	if (type == 'authCode') {
		await processAuthCode(job.data.identityUuid, job.data.code)
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

async function twitterAuth(authCode: string, verifier: string) {
	const params = {
      code: authCode,
      grant_type: "authorization_code",
      code_verifier: verifier,
      client_id: config.twitter.clientId,
      redirect_uri: config.twitter.redirectUri,
    }
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
		logger.error(json)
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
	let resp
	try {
		let resp = await twitterAuth(code, verifier)
	} catch (e) {
		logger.error('Error during twitter auth token retrieval for %s', identityUuid)
		logger.error(e)
		return
	}
	let tokenData = processTokenResponse(resp)
	if (!tokenData) {
		return
	}
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
	logger.info('Stored twitter token for user %s', identityUuid)
}
