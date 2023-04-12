import { Op } from 'sequelize'
import { logger } from '../logger'
import { Quest, TwitterActivity, Battlepass, BattlepassParticipant, Identity } from '../db'
import { getClient, apiWrapper } from './client'

async function getFollowingAccounts(userId: string) {
	let client = getClient().getNextClient()
	let follows = []
	try {
		for await (let page of client.users.usersIdFollowing(userId, { max_results: 1000 })) {
			if (page.data) {
				follows.push(...page.data)
			}
		}
		return follows
	} catch (error) {
		logger.error('Failed to fetch user following accounts')
		logger.error(JSON.stringify(error))
		return null
	}
}

async function getExistingFollows(twitterUsers: Identity[]): Promise<Set<string>> {
	let followers = await TwitterActivity.findAll({
		where: {
			activityType: 'follow',
			authorId: twitterUsers.map(i => i.twitter || '')
		},
		attributes: ['authorId', 'objectId']
	})
	let set = new Set<string>()
	followers.map((i) => {
		set.add(`${i.authorId}:${i.objectId}`)
	})
	return set
}

async function processUserFollowings(
	userId: string,
	existingFollows: Set<string>,  // followerId:followingId
	newObjects: any[],
) {
	let allFollows = await apiWrapper(getFollowingAccounts(userId))
	if (!allFollows) {
		return
	}
	let newFollowersCnt = 0
	for (let record of allFollows) {
		let followerUserId = record.id
		let followId = `${userId}:${record.id}`
		if (existingFollows.has(followId)) {
			continue
		}
		existingFollows.add(followId)
		let item = {
			objectAuthor: record.username.toLowerCase(),
			objectId: record.id,
			authorId: userId,
			activityType: 'follow',
		}
		newObjects.push(item)
		newFollowersCnt += 1
	}
	if (newFollowersCnt) {
		logger.debug('Collected %s new follows for user %s', newFollowersCnt, userId)
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
	let users = await Identity.findAll({
		where: { twitter: { [Op.ne]: null } },
		include: [{
			model: BattlepassParticipant,
			required: true,
			where: { battlepassId: battlepass.id }
		}],
		attributes: ['twitter']
	})
	let existing = await getExistingFollows(users)
	for (let identity of users) {
		if (identity.twitter)
			await processUserFollowings(identity.twitter, existing, newObjects)
	}
}
