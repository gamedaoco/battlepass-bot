import { config, validateConfigs } from '../config'
import { logger } from '../logger'
import { TwitterActivity } from '../db'
import { getActiveBattlePasses } from '../chain/chain'
import { sequelize, initDB, Quest, Battlepass } from '../db'
import { getClient } from './client'
import { processTweetQuests } from './tweets'
import { processLikeQuests } from './likes'
import { processCommentQuests } from './comments'
import { processRetweetQuests } from './retweets'
import { processFollowQuests } from './follows'

async function getTwitterUserIdsByNames(usernames: string[]): Promise<Map<string, string>> {
	if (usernames.length > 100) {
		throw Error('Usernames must be not more then 100')
	}
	let client = getClient()
	let result = new Map<string, string>()
	try {
		let resp = await client.users.findUsersByUsername({ usernames })
		if (resp.data) {
			resp.data.map((i) => {
				result.set(i.id, i.username)
			})
		} else {
			logger.warn('Received invalid response for users by username twitter api call')
		}
	} catch (error) {
		logger.error('Failed to fetch user ids by names')
		logger.error(error)
	}
	return result
}

async function getUserTweets(twitterUserId: string, since: Date, before: Date) {
	let client = getClient()
	let twitterAccountId: string
	let tweets = []
	try {
		let req = client.tweets.usersIdTweets(twitterUserId, {
			start_time: since.toISOString(),
			end_time: before.toISOString(),
		})
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

async function iteration(again: boolean) {
	const battlepasses = await getActiveBattlePasses()
	if (battlepasses.size) {
		logger.debug('Iteration with %s battlepasses', battlepasses.size)
	} else {
		logger.debug('Iteration')
	}
	let newItems: any[] = []
	let allQuests = await Quest.findAll({
		where: {
			battlepassId: Array.from(battlepasses.values()).map((i) => i.id),
			source: 'twitter',
		},
	})
	let twitterUsernames = new Set<string>()
	let questsByBattlepass = new Map<number, Quest[]>()
	for (let quest of allQuests) {
		let bpQuests = questsByBattlepass.get(quest.battlepassId)
		if (!bpQuests) {
			bpQuests = new Array<Quest>()
			questsByBattlepass.set(quest.battlepassId, bpQuests)
		}
		bpQuests.push(quest)

		if (quest.source == 'twitter' && quest.type != 'tweet') {
			let followUsername = quest.twitterId || ''
			if (followUsername.charAt(0) === '@') {
				followUsername = followUsername.substring(1)
			}
			if (followUsername) {
				twitterUsernames.add(followUsername)
			}
		}
	}
	if (!twitterUsernames.size) {
		logger.debug('Skipping twitter activities processing due to no active quests')
		return
	}
	let usersMap = await getTwitterUserIdsByNames(Array.from(twitterUsernames.values()))
	for (let [_, battlepass] of battlepasses) {
		let quests = questsByBattlepass.get(battlepass.id)
		if (!quests || !quests.length) {
			continue
		}
		let tweets = new Map<string, string[]>()
		let since = battlepass.startDate || new Date()
		let before = battlepass.endDate || new Date()
		for (let [userid, username] of usersMap) {
			let userTweets = await getUserTweets(userid, since, before)
			if (!userTweets) {
				continue
			}
			let tweetIds = new Array<string>()
			for (let tweet of userTweets) {
				tweetIds.push(tweet.id)
			}
			tweets.set(userid, tweetIds)
		}
		await processTweetQuests(battlepass, quests, newItems)
		await processLikeQuests(battlepass, quests, tweets, usersMap, newItems)
		await processCommentQuests(battlepass, quests, tweets, usersMap, newItems)
		await processRetweetQuests(battlepass, quests, tweets, usersMap, newItems)
		await processFollowQuests(battlepass, quests, usersMap, newItems)
	}
	if (newItems.length) {
		logger.debug('Saving %s new twitter acitvities', newItems.length)
		await TwitterActivity.bulkCreate(newItems)
	}
	if (again) {
		setTimeout(async () => {
			await iteration(true)
		}, config.twitter.checkFrequency * 1000)
	}
}

async function main() {
	validateConfigs('twitter')
	if (!(await initDB())) {
		logger.error('Failed to connect to database.')
		return -1
	}
	await sequelize.sync()
	await iteration(true)
}

main().catch((error) => logger.error(error))
