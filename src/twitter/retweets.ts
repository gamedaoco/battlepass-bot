import { Op } from 'sequelize'

import { logger } from '../logger'
import { Quest, TwitterSearch, TwitterActivity, Battlepass } from '../db'
import { getClient, apiWrapper } from './client'

async function getRetweets(tweetId: string) {
	let client = getClient().getNextClient()
	let retweets = []
	try {
		for await (let page of client.users.tweetsIdRetweetingUsers(tweetId)) {
			if (page.data) {
				retweets.push(...page.data)
			}
		}
		return retweets
	} catch (error) {
		logger.error('Failed to fetch retweets')
		logger.error(error)
		return null
	}
}

async function getExistingRetweets(
	twitterUserNames: string[],
	since: Date,
	before: Date,
): Promise<Map<string, Set<string>>> {
	let existingFollowers = await TwitterActivity.findAll({
		where: {
			activityType: 'retweet',
			objectAuthor: twitterUserNames,
			createdAt: {
				[Op.between]: [since, before],
			},
		},
		attributes: ['authorId', 'objectId'],
	})
	let map = new Map<string, Set<string>>()
	existingFollowers.map((i) => {
		let arr = map.get(i.objectId || '')
		if (!arr) {
			arr = new Set<string>()
			map.set(i.objectId || '', arr)
		}
		arr.add(i.authorId || '')
	})
	return map
}

async function processTweetRetweets(
	tweetId: string,
	tweetAuthor: string,
	existingRetweets: Set<string>,
	newObjects: any[],
) {
	let retweetUsers = await apiWrapper(getRetweets(tweetId))
	if (!retweetUsers) {
		return
	}
	let newCnt = 0
	for (let record of retweetUsers) {
		let retweetUserId = record.id
		if (existingRetweets.has(retweetUserId)) {
			continue
		}
		let item = {
			objectAuthor: tweetAuthor,
			objectId: tweetId,
			authorId: retweetUserId,
			activityType: 'retweet',
		}
		newObjects.push(item)
		newCnt += 1
	}
	if (newCnt) {
		logger.debug('Collected %s new retweets for tweet %s of author %s', newCnt, tweetId, tweetAuthor)
	}
}

export async function processRetweetQuests(
	battlepass: Battlepass,
	followQuests: Quest[],
	tweets: Map<string, string[]>, // userId: tweetIds
	twitterUsers: Map<string, string>, // userId: userName
	newObjects: any[],
) {
	let usersToCheck = new Set<string>()
	for (let quest of followQuests) {
		if (quest.source === 'twitter' && quest.type === 'retweet' && quest.twitterId) {
			usersToCheck.add(quest.twitterId)
		}
	}
	if (!usersToCheck.size) {
		return
	}
	let existingRetweets = await getExistingRetweets(
		Array.from(usersToCheck.values()),
		battlepass.startDate || new Date(),
		battlepass.endDate || new Date(),
	)
	for (let [twitterUserId, tweetIds] of tweets) {
		let username = twitterUsers.get(twitterUserId) || ''
		if (!username) {
			logger.warn('Not found retweet username for twitter account with id %s', twitterUserId)
			continue
		}
		if (!usersToCheck.has(username)) {
			continue
		}
		for (let tweetId of tweetIds) {
			let existing = existingRetweets.get(tweetId)
			if (!existing) {
				existing = new Set<string>()
				existingRetweets.set(tweetId, existing)
			}
			await processTweetRetweets(tweetId, username, existing, newObjects)
		}
	}
}
