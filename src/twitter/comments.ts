import { Op } from 'sequelize'

import { logger } from '../logger'
import { Quest, TwitterSearch, TwitterActivity, Battlepass } from '../db'
import { getClient } from './client'

async function getNewComments(tweetId: string, since: Date | null) {
	const client = getClient()
	let params: any = {
		query: `conversation_id:${tweetId}`,
		expansions: ['author_id'],
		'tweet.fields': ['created_at'],
	}
	if (since && Date.now() - since.getTime() < 7 * 24 * 60 * 60 * 1000) {
		params['start_time'] = since.toISOString()
	}
	let results = []
	try {
		for await (const page of client.tweets.tweetsRecentSearch(params)) {
			if (page.data) {
				results.push(...page.data)
			}
		}
		return results
	} catch (error) {
		logger.error('Failed to fetch retweets')
		logger.error(error)
		return null
	}
}

async function getExistingComments(
	twitterUsernames: string[],
	since: Date,
	before: Date,
): Promise<Map<string, Set<string>>> {
	let existingComments = await TwitterActivity.findAll({
		where: {
			activityType: 'comment',
			objectAuthor: twitterUsernames,
			createdAt: {
				[Op.between]: [since, before],
			},
		},
		attributes: ['authorId', 'objectId'],
	})
	let map = new Map<string, Set<string>>()
	existingComments.map((i) => {
		let arr = map.get(i.objectId || '')
		if (!arr) {
			arr = new Set<string>()
			map.set(i.objectId || '', arr)
		}
		arr.add(i.authorId || '')
	})
	return map
}

async function processTweetComments(
	tweetId: string,
	tweetAuthor: string,
	existingLikes: Set<string>,
	since: Date | null,
	newObjects: any[],
) {
	// todo: `since` parameter from last update time
	let comments = await getNewComments(tweetId, since)
	if (!comments) {
		return
	}
	for (let record of comments) {
		if (record.id == tweetId || existingLikes.has(record.author_id || '')) {
			continue
		}
		let item = {
			objectAuthor: tweetAuthor,
			objectId: tweetId,
			authorId: record.author_id,
			activityId: record.id,
			activityType: 'comment',
		}
		newObjects.push(item)
	}
}

export async function processCommentQuests(
	battlepass: Battlepass,
	commentQuests: Quest[],
	tweets: Map<string, string[]>, // userId: tweetIds
	twitterUsers: Map<string, string>, // userId: userName
	newObjects: any[],
) {
	let usersToCheck = new Set<string>()
	for (let quest of commentQuests) {
		if (quest.source === 'twitter' && quest.type === 'comment' && quest.twitterId) {
			usersToCheck.add(quest.twitterId)
		}
	}
	if (!usersToCheck.size) {
		return
	}
	let existingComments = await getExistingComments(
		Array.from(usersToCheck.values()),
		battlepass.startDate || new Date(),
		battlepass.endDate || new Date(),
	)
	for (let [twitterUserId, tweetIds] of tweets) {
		let username = twitterUsers.get(twitterUserId) || ''
		if (!username) {
			logger.warn('Not found comment username for twitter account with id %s', twitterUserId)
			continue
		}
		if (!usersToCheck.has(username)) {
			continue
		}
		for (let tweetId of tweetIds) {
			let existing = existingComments.get(tweetId)
			if (!existing) {
				existing = new Set<string>()
				existingComments.set(tweetId, existing)
			}
			await processTweetComments(tweetId, username, existing, battlepass.startDate, newObjects)
		}
	}
}
