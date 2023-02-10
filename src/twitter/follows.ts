import { logger } from '../logger'
import { Quest, TwitterActivity, Battlepass } from '../db'
import { getClient } from './client'

async function getUserFollowers(userId: string) {
	let client = getClient()
	let follows = []
	try {
		for await (let page of client.users.usersIdFollowers(userId, { max_results: 1000 })) {
			if (page.data) {
				follows.push(...page.data)
			}
		}
		return follows
	} catch (error) {
		logger.error('Failed to fetch user followers')
		logger.error(error)
		return null
	}
}

async function getExistingFollowers(usernames: string[]): Promise<Map<string, Set<string>>> {
	let existingFollowers = await TwitterActivity.findAll({
		where: {
			activityType: 'follow',
			objectAuthor: usernames,
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

async function processUserFollowers(
	userId: string,
	userName: string,
	existingFollowers: Set<string>,
	newObjects: any[],
) {
	let allFollowers = await getUserFollowers(userId)
	if (!allFollowers) {
		return
	}
	let newFollowersCnt = 0
	for (let record of allFollowers) {
		let followerUserId = record.id
		if (existingFollowers.has(followerUserId)) {
			continue
		}
		existingFollowers.add(followerUserId)
		let item = {
			objectAuthor: userName,
			objectId: userId,
			authorId: followerUserId,
			activityType: 'follow',
		}
		newObjects.push(item)
		newFollowersCnt += 1
	}
	if (newFollowersCnt) {
		logger.debug('Collected %s new followers for user %s', newFollowersCnt, userName)
	}
}

export async function processFollowQuests(
	battlepass: Battlepass,
	followQuests: Quest[],
	twitterUsers: Map<string, string>, // userId: userName
	newObjects: any[],
) {
	let usersToCheck = new Set<string>()
	for (let quest of followQuests) {
		if (quest.source === 'twitter' && quest.type === 'follow' && quest.twitterId) {
			usersToCheck.add(quest.twitterId)
		}
	}
	if (!usersToCheck.size) {
		return
	}
	let existing = await getExistingFollowers(Array.from(twitterUsers.values()))
	for (let [userId, username] of twitterUsers) {
		if (!usersToCheck.has(username)) {
			continue
		}
		let existingUserFollowers = existing.get(userId)
		if (!existingUserFollowers) {
			existingUserFollowers = new Set<string>()
			existing.set(userId, existingUserFollowers)
		}
		await processUserFollowers(userId, username, existingUserFollowers, newObjects)
	}
}
