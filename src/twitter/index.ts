import pkg from '../../package.json'
import { config, validateConfigs } from '../config'
import { logger } from '../logger'
import { TwitterActivity, TwitterUser } from '../db'
import { getActiveBattlePasses } from '../chain/chain'
import { sequelize, initDB, Quest, Battlepass } from '../db'
import { getWorker } from '../queue'
import { getClient, apiWrapper, getTwitterUserIdsByNames } from './client'
import { processTweetQuests } from './tweets'
import { processLikeQuests } from './likes'
import { processCommentQuests, processTweetComments } from './comments'
import { processRetweetQuests } from './retweets'
import { processFollowQuests } from './follows'
import { worker } from './worker'

async function getUsesrCache(usernames: string[]): Promise<Map<string, string>> {
	let res = await TwitterUser.findAll({
		where: { username: usernames }
	})
	let map = new Map<string, string>()
	for (let user of res) {
		map.set(user.twitterId, user.username)
	}
	return map
}

async function getTwitterUsers(usernames: string[]): Promise<Map<string, string>> {
	let cache = await getUsesrCache(usernames)
	let values = new Set<string>(cache.values())
	let missingUsernames = []
	for (let username of usernames) {
		if (!values.has(username)) {
			missingUsernames.push(username)
		}
	}
	if (missingUsernames.length) {
		let newUsernames = await getTwitterUserIdsByNames(missingUsernames)
		let toCreate = []
		for (let [twitterId, username] of newUsernames) {
			username = username.toLowerCase()
			toCreate.push({ username, twitterId })
			cache.set(twitterId, username)
		}
		await TwitterUser.bulkCreate(toCreate)
		logger.debug('Created new twitter users map', toCreate.length)
	}
	return cache
}

async function getUserTweets(twitterUserId: string, since: Date, before: Date) {
	let client = getClient().getNextClient()
	let twitterAccountId: string
	let tweets = []
	try {
		let req = client.tweets.usersIdTweets(twitterUserId, {
			start_time: since.toISOString(),
			end_time: before.toISOString(),
			exclude: ['retweets', 'replies'],
			max_results: 100
		})
		for await (let page of req) {
			if (page.data) {
				tweets.push(...page.data)
			}
		}
	} catch (error: any) {
		logger.error('Failed to get user %s recent tweets', twitterUserId)
		logger.error(error.toString())
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
				twitterUsernames.add(followUsername.toLowerCase())
			}
		}
	}
	if (!twitterUsernames.size) {
		logger.debug('Skipping twitter activities processing due to no active quests')
		return
	}
	let cli = getClient()
	await cli.populateTokens()
	let usersMap = await getTwitterUsers(Array.from(twitterUsernames.values()))
	cli.reset()
	let tweets = new Map<string, string[]>()
	let since = new Date()
	let before = new Date()
	for (let battlepass of battlepasses.values()) {
		if (battlepass.startDate && battlepass.startDate < since) {
			since = battlepass.startDate
		}
	}
	for (let [userid, username] of usersMap) {
		let userTweets = await apiWrapper(getUserTweets(userid, since, before))
		if (!userTweets) {
			continue
		}
		let tweetIds = new Array<string>()
		for (let tweet of userTweets) {
			tweetIds.push(tweet.id)
		}
		tweets.set(userid, tweetIds)
	}
	cli.reset()

	for (let battlepass of battlepasses.values()) {
		let quests = questsByBattlepass.get(battlepass.id)
		if (!quests || !quests.length) {
			continue
		}
		await processTweetQuests(battlepass, quests, newItems)
		cli.reset()
		await processLikeQuests(battlepass, quests, tweets, usersMap, newItems)
		cli.reset()
		await processCommentQuests(battlepass, quests, tweets, usersMap, newItems)
		cli.reset()
		await processRetweetQuests(battlepass, quests, tweets, usersMap, newItems)
	}
	await processFollowQuests(newItems)
	if (newItems.length) {
		logger.debug('Saving %s new twitter acitvities', newItems.length)
		await TwitterActivity.bulkCreate(newItems)
	}
	if (again) {
		setTimeout(async () => {
			await iteration(true)
		}, cli.waitTime * 1000)
	}
}

async function main() {
	logger.info(`${pkg.name} ${pkg.version}`)
	logger.info('initializing...')
	validateConfigs('twitter')
	if (!(await initDB())) {
		logger.error('Failed to connect to database.')
		return -1
	}
	await sequelize.sync()
	let tasksWorker = getWorker('twitter', worker)
	await iteration(true)
}

main().catch((error) => logger.error(error))
