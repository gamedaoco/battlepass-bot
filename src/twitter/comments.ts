import { Op } from 'sequelize'
import { auth } from 'twitter-api-sdk'

import { logger } from '../logger'
import { Quest, TwitterSearch, TwitterActivity, TwitterUser, Battlepass } from '../db'
import { getClient, getTwitterUserIdsByNames, apiWrapper } from './client'

async function getNewComments(tweetId: string, hashtag: string | null, since: Date | null) {
	const api = getClient().getNextClient()
	let query = `conversation_id:${tweetId}`
	if (hashtag) {
		query += ` #${hashtag}`
	}
	let params: any = {
		query,
		expansions: ['author_id'],
		'tweet.fields': ['created_at'],
	}
	if (since && Date.now() - since.getTime() < 7 * 24 * 60 * 60 * 1000) {
		params['start_time'] = since.toISOString()
	}
	let results = []
	try {
		for await (const page of api.tweets.tweetsRecentSearch(params)) {
			if (page.data) {
				results.push(...page.data)
			}
		}
		return results
	} catch (error) {
		logger.error('Failed to fetch comments')
		logger.error(error)
		return null
	}
}

async function getExistingComments(
	twitterUsernames: string[],
	tweetIds: string[],
	since: Date,
	before: Date,
): Promise<Map<string, Set<string>>> {
	let or: any = [{ objectId: tweetIds }]
	if (tweetIds.length) {
		or.push({ objectAuthor: twitterUsernames })
	}
	let existingComments = await TwitterActivity.findAll({
		where: {
			activityType: 'comment',
			createdAt: { [Op.between]: [since, before]},
			[Op.or]: or
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

export async function processTweetComments(
	tweetId: string,
	existingComments: Set<string>,
	since: Date | null,
	newObjects: any[],
	twitterUsers: Map<string, string>,
	tweetAuthor: string | null,
	hashtag: string | null,
) {
	// todo: `since` parameter from last update time
	let comments = await apiWrapper(getNewComments(tweetId, hashtag, since))
	if (!comments) {
		return
	}
	for (let record of comments) {
		let authorId = record.author_id || ''
		if (record.id == tweetId) {
			if (!tweetAuthor) {
				tweetAuthor = twitterUsers.get(authorId) || ''
				if (!tweetAuthor) {
					let data = await getTwitterUserIdsByNames([tweetAuthor])
					for (let [twitterId, username] of data) {
						username = username.toLowerCase()
						twitterUsers.set(twitterId, username)
						await TwitterUser.create({ username, twitterId })
					}
					tweetAuthor = twitterUsers.get(authorId) || ''
				}
			}
			continue
		} else if (existingComments.has(authorId)) {
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
	let tweetsToCheck = new Map<string, string>()  // tweet id <-> hashtag to be present
	let tweetPattern = /^\d+$/
	for (let quest of commentQuests) {
		if (quest.source === 'twitter' && quest.type === 'comment' && quest.twitterId) {
			if (tweetPattern.test(quest.twitterId)) {
				let hashtag = quest.hashtag || ''
				if (hashtag.charAt(0) == '#') {
					hashtag = hashtag.substring(1)
				}
				tweetsToCheck.set(quest.twitterId, hashtag)
			} else {
				usersToCheck.add(quest.twitterId)
			}
		}
	}
	if (!usersToCheck.size && !tweetsToCheck.size) {
		return
	}
	let existingComments = await getExistingComments(
		Array.from(usersToCheck.values()),
		Array.from(tweetsToCheck.keys()),
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
			if (tweetsToCheck.has(tweetId)) {
				continue
			}
			let existing = existingComments.get(tweetId)
			if (!existing) {
				existing = new Set<string>()
				existingComments.set(tweetId, existing)
			}
			await processTweetComments(tweetId, existing, battlepass.startDate, newObjects, twitterUsers, username, null)
		}
	}
	for (let [tweetId, hashtag] of tweetsToCheck) {
		let existing = existingComments.get(tweetId)
			if (!existing) {
				existing = new Set<string>()
				existingComments.set(tweetId, existing)
			}
			await processTweetComments(tweetId, existing, battlepass.startDate, newObjects, twitterUsers, null, hashtag)
	}
}
