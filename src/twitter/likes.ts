import { Op } from 'sequelize'

import { TwitterActivity, Battlepass, Quest } from '../db'
import { logger } from '../logger'
import { getClient } from './client'

async function getTweetLikes(tweetId: string) {
	let client = getClient()
	let likes = []
	try {
		for await (let page of client.users.tweetsIdLikingUsers(tweetId)) {
			if (page.data) {
				likes.push(...page.data)
			}
		}
		return likes
	} catch (error) {
		logger.error('Failed to fetch tweet likers')
		logger.error(error)
		return null
	}
}

async function getExistingLikes(
	twitterUsernames: string[],
	since: Date,
	before: Date,
): Promise<Map<string, Set<string>>> {
	let existingLikes = await TwitterActivity.findAll({
		where: {
			activityType: 'like',
			objectAuthor: twitterUsernames,
			createdAt: {
				[Op.between]: [since, before],
			},
		},
		attributes: ['authorId', 'objectId'],
	})
	let map = new Map<string, Set<string>>()
	existingLikes.map((i) => {
		let item = map.get(i.objectId || '')
		if (!item) {
			item = new Set<string>()
			map.set(i.objectId || '', item)
		}
		item.add(i.authorId || '')
	})
	return map
}

async function processTweetLikes(tweetId: string, tweetAuthor: string, existingLikes: Set<string>, newObjects: any[]) {
	let tweetLikes = await getTweetLikes(tweetId)
	if (tweetLikes) {
		let newCnt = 0
		for (let record of tweetLikes) {
			let twitterUserId = record.id
			if (existingLikes.has(twitterUserId)) {
				continue
			}
			newCnt += 1
			newObjects.push({
				objectAuthor: tweetAuthor,
				objectId: tweetId,
				authorId: twitterUserId,
				activityType: 'like',
			})
		}
		if (newCnt) {
			logger.debug('Collected %s new likes for tweet %s of author %s', newCnt, tweetId, tweetAuthor)
		}
	}
}

export async function processLikeQuests(
	battlepass: Battlepass,
	likeQuests: Quest[],
	tweets: Map<string, string[]>, // userId: tweetIds
	twitterUsers: Map<string, string>, // userId: userName
	newObjects: any[],
) {
	let usersToCheck = new Set<string>()
	for (let quest of likeQuests) {
		if (quest.source === 'twitter' && quest.type === 'like' && quest.twitterId) {
			usersToCheck.add(quest.twitterId)
		}
	}
	if (!usersToCheck.size) {
		return
	}
	let existingLikes = await getExistingLikes(
		Array.from(usersToCheck.values()),
		battlepass.startDate || new Date(),
		battlepass.endDate || new Date(),
	)
	for (let [twitterUserId, tweetIds] of tweets) {
		let username = twitterUsers.get(twitterUserId) || ''
		if (!username) {
			logger.warn('Not found like username for twitter account with id %s', twitterUserId)
			continue
		}
		if (!usersToCheck.has(username)) {
			continue
		}
		for (let tweetId of tweetIds) {
			await processTweetLikes(tweetId, username, existingLikes.get(tweetId) || new Set(), newObjects)
		}
	}
}
