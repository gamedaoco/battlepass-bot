import { logger } from '../logger'
import { Quest, TwitterSearch, Battlepass } from '../db'
import { getClient, apiWrapper } from './client'

async function getNewTweets(since: Date | null, query: string) {
	const client = getClient().getNextClient()
	let params: any = {
		query: `${query} -is:retweet`,
		expansions: ['author_id'],
		'tweet.fields': ['created_at'],
	}
	if (since) {
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
		logger.error('Failed to fetch tweets')
		logger.error(error)
		return null
	}
}

async function processTweets(
	recentSearch: TwitterSearch | null,
	query: string,
	battlepassStartDate: Date,
	newObjects: any[],
) {
	let since: Date
	if (recentSearch) {
		query = recentSearch.query
		since = recentSearch.executedAt
	} else {
		since = battlepassStartDate
	}
	let newTweets = await getNewTweets(since, query)
	if (newTweets) {
		for (const tweet of newTweets) {
			newObjects.push({
				activityType: 'tweet',
				activityId: tweet.id,
				authorId: tweet.author_id,
				createdAt: tweet.created_at,
			})
		}
		if (recentSearch) {
			recentSearch.executedAt = new Date()
			await recentSearch.save()
		} else {
			TwitterSearch.create({
				query,
				executedAt: new Date(),
			})
		}
	} else {
		logger.warn('Twitter tweets response invalid for query %s', query)
		logger.warn(newTweets)
	}
}

export async function processTweetQuests(battlepass: Battlepass, tweetQuests: Quest[], newObjects: any[]) {
	let uniqueHashtags = new Set<string>()
	for (let quest of tweetQuests) {
		if (quest.source != 'twitter' || quest.type != 'tweet' || !quest.hashtag) {
			continue
		}
		uniqueHashtags.add(quest.hashtag)
	}
	for (let hashtag of uniqueHashtags) {
		let recentSearch = await TwitterSearch.findOne({
			where: {
				query: hashtag,
			},
		})
		await processTweets(recentSearch, hashtag, battlepass.startDate || new Date(), newObjects)
	}
}
