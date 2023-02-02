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

async function getExistingLikes(tweetId: string): Promise<Set<string>> {
	let existingLikes = await TwitterActivity.findAll({
		where: {
			activityType: 'like',
			objectId: tweetId,
		},
		attributes: ['authorId'],
	})
	let set = new Set<string>()
	existingLikes.map((i) => {
		set.add(i.authorId)
	})
	return set
}

async function processTweetLikes(tweetId: string, tweetAuthor: string, newObjects: any[]) {
	let tweetLikes = await getTweetLikes(tweetId)
	if (tweetLikes) {
		let existingLikes = await getExistingLikes(tweetId)
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
			logger.debug('Collected %s new likes for tweet %s', newCnt, tweetId)
		}
	}
}

async function getTwitterUserIdsByNames(usernames: string[]): Promise<Map<string, string>> {
	if (usernames.length > 100) {
		throw Error('Usernames must be not more then 100')
	}
	let client = getClient()
	let resp = await client.users.findUsersByUsername({ usernames: usernames })
	let result = new Map<string, string>()
	if (resp.data) {
		resp.data.map((i) => {
			result.set(i.username, i.id)
		})
	} else {
		logger.warn('Received invalid response for users by username twitter api call')
	}
	return result
}

async function getTweetsToCheck(since: Date, twitterUserId: string) {
	let client = getClient()
	let twitterAccountId: string
	let tweets = []
	try {
		let req = client.tweets.usersIdTweets(twitterUserId, { start_time: since.toISOString() })
		for await (let page of req) {
			if (page.data) {
				tweets.push(...page.data)
			}
		}
	} catch (error) {
		logger.error('Failed to get user %s recent tweets', twitterUserId)
		logger.error(error)
	}

	return tweets
}

export async function processLikeQuests(battlepass: Battlepass, likeQuests: Quest[], newObjects: any[]) {
	let twitterAuthorsToCheck = new Set<string>()
	for (let quest of likeQuests) {
		if (quest.source != 'twitter' || quest.type != 'like' || !quest.twitterId) {
			continue
		}
		twitterAuthorsToCheck.add(quest.twitterId)
	}
	if (!twitterAuthorsToCheck) {
		return
	}
	let twitterAccountIds = await getTwitterUserIdsByNames(Array.from(twitterAuthorsToCheck.values()))
	for (let [twitterName, twitterId] of twitterAccountIds) {
		let tweets = await getTweetsToCheck(battlepass.startDate || new Date(), twitterId)
		if (!tweets.length) {
			continue
		}
		for (let tweet of tweets) {
			await processTweetLikes(tweet.id, twitterName, newObjects)
		}
	}
}
