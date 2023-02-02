import { Op } from 'sequelize'
import { ApiPromise, WsProvider, Keyring } from '@polkadot/api'

import { config } from '../config'
import { logger } from '../logger'
import { Battlepass, Quest, QuestProgress, CompletedQuest, DiscordActivity, TwitterActivity, Identity, ChainStatus, BattlepassParticipant, sequelize } from '../db'
import { calculateBlockDate } from '../indexer/indexer'

export async function connectToNode(): Promise<ApiPromise> {
	const provider = new WsProvider(config.chain.rpcUrl)
	const api = await ApiPromise.create({ provider })
	if (!api.isConnected) {
		throw new Error('Failed to connect to chain RPC node.')
	}
	return api
}

export async function listenNewEvents(api: ApiPromise, knownBlock: number, knownDate: Date) {
	await api.rpc.chain.subscribeNewHeads(async (header) => {
		const at = await api.at(header.hash)
		const events: any = await at.query.system.events()
		await events.forEach(async (record: any) => {
			let event = record.event
			if (api.events.battlepass.BattlepassActivated.is(event)) {
				let [byWho, orgId, bpId] = event.data
				const chainBp: any = await api.query.battlepass.battlepasses(bpId.toString())
				await Battlepass.findOrCreate({
					where: {
						chainId: bpId.toString(),
					},
					defaults: {
						chainId: bpId.toString(),
						startDate: calculateBlockDate(knownDate, knownBlock, header.number.toNumber()),
						orgId: orgId.toString(),
						name: chainBp ?
							Buffer.from(chainBp.value.name, 'hex').toString() :
							null,
						active: true,
						finalized: false,
					},
				})
				logger.debug('Found new active battlepass %s', bpId.toString())
			} else if (api.events.battlepass.BattlepassEnded.is(event)) {
				let [byWho, orgId, bpId] = event.data
				let bp = await Battlepass.findOne({
					where: { chainId: bpId.toString() },
				})
				if (bp == null) {
					logger.error('Found chain event about finished unknown battlepass')
					return
				}
				bp.endDate = calculateBlockDate(knownDate, knownBlock, header.number.toNumber())
				bp.active = false
				await bp.save()
				logger.debug('Found ended battlepass %s', bpId.toString())
			} else if (api.events.battlepass.BattlepassClaimed.is(event)) {
				let [byWho, forWho, orgId, bpId, nftId] = event.data
				let bp = await Battlepass.findOne({
					where: { chainId: bpId.toString() }
				})
				if (bp == null) {
					logger.error('Found chain event about claimed unknown battlepass')
					return
				}
				let [identity, _] = await Identity.findOrCreate({
					where: { address: forWho.toString() },
				})
				let [participant, created] = await BattlepassParticipant.findOrCreate({
					where: { identityId: identity.id },
					defaults: {
						identityId: identity.id,
						battlepassId: bp.id
					}
				})
				if (created) {
					let quests = await Quest.findAll({
						where: { battlepassId: bp.id }
					})
					if (quests.length) {
						let newProgress: any = []
						quests.map(q => {
							newProgress.push({
								questId: q.id,
								identityId: identity.id,
								progress: 0
							})
						})
						logger.debug('Creating new progress records for user %s and battlepass %s', identity.address, bp.chainId)
						await QuestProgress.bulkCreate(newProgress)
					}
				}
			}
		})
		await ChainStatus.update({ blockNumber: header.number.toNumber() }, { where: { id: 1 } })
	})
}

export async function getActiveBattlePasses(): Promise<Map<string, Battlepass>> {
	let map = new Map<string, Battlepass>()
	let query = await Battlepass.findAll({
		where: {
			[Op.or]: [{ active: true }, { active: false, finalized: false }],
		},
	})
	query.map((item) => {
		map.set(item.chainId, item)
	})
	return map
}

async function getBattlepassQuests(battlePassId: string): Promise<Quest[]> {
	return await Quest.findAll({
		where: {
			source: ['discord', 'twitter'],
		},
		include: [
			{
				model: Battlepass,
				required: true,
				attributes: [],
				where: {
					chainId: battlePassId,
				},
			},
		],
	})
}

async function getBasicUsersActivity(identities: number[]): Promise<DiscordActivity[]> {
	return await DiscordActivity.findAll({
		include: [
			{
				model: Identity,
				required: true,
				attributes: [],
				where: {
					id: identities,
				},
			},
		],
		where: {
			activityType: ['connect', 'join'],
		},
	})
}

async function getDiscordUsersActivity(
	identities: number[],
	startDate: Date,
	endDate: Date
): Promise<DiscordActivity[]> {
	return await DiscordActivity.findAll({
		attributes: [
			'identityId',
			'guildId',
			'channelId',
			[sequelize.fn('date', sequelize.col('DiscordActivity.createdAt')), 'date'],
			[sequelize.fn('count', '*'), 'messagesCnt'],
		],
		where: {
			createdAt: {
				[Op.gte]: startDate,
				[Op.lte]: endDate,
			},
			activityType: 'post',
			identityId: identities,
		},
		group: ['date', 'identityId', 'guildId', 'channelId'],
		order: ['date', 'identityId'],
	})
}

async function getCompletedQuests(questIds: number[]) {
	return await CompletedQuest.findAll({
		attributes: ['questId', 'identityId', [sequelize.fn('count', '*'), 'cnt']],
		where: {
			questId: questIds,
		},
		group: ['questId', 'identityId'],
	})
}

async function getCurrentProgress(battlepassId: number): Promise<Map<string, QuestProgress>> {
	let res = await QuestProgress.findAll({
		include: [{
			model: Quest,
			required: true,
			attributes: [],
			where: {
				battlepassId
			}
		}]
	})
	let map = new Map<string, QuestProgress>()
	res.map(i => {
		let key = `${i.questId}-${i.identityId}`
		map.set(key, i)
	})
	return map
}

async function getCompletedQuestsForUser(
	identityId: number,
	quest: Quest,
	userActivity: any[],
	completedBefore: number,
	currentProgress: Map<string, QuestProgress>
) {
	if (!quest.repeat && completedBefore) {
		return []
	}
	let maxPerDay = quest.quantity
	if (quest.repeat) {
		maxPerDay *= quest.maxDaily || 1
	}
	let totalActivity = 0
	for (let activity of userActivity) {
		if (activity.get('identityId') != identityId) {
			continue
		}
		if (quest.channelId && activity.get('channelId') != quest.channelId) {
			continue
		}
		totalActivity += Math.min(maxPerDay, activity.get('messagesCnt'))
	}
	let progressBefore = currentProgress.get(`${quest.id}-${identityId}`)
	let progressNew = parseFloat((totalActivity / quest.quantity).toFixed(2))
	if (progressNew > 1 && !quest.repeat) {
		progressNew = 1
	}
	if (progressBefore !== undefined) {
		if (progressNew != progressBefore.progress) {
			progressBefore.progress = progressNew
			await progressBefore.save()
		}
	} else {
		logger.warn('Current quest progress not specified for quest %s and identity %s', quest.id, identityId)
	}
	let completedCount = Math.floor(progressNew)
	if (!quest.repeat && completedCount > 1) {
		completedCount = 1
	}
	if (!completedCount || completedCount <= completedBefore) {
		return []
	}
	let record = {
		identityId: identityId,
		questId: quest.id,
		guildId: userActivity[0].guildId,
	}
	return Array(completedCount - completedBefore).fill(record)
}

async function processBasicQuests(
	basicQuests: Quest[],
	basicAcitivity: DiscordActivity[],
	alreadyCompletedQuests: CompletedQuest[],
	currentProgress: Map<string, QuestProgress>
): Promise<any[]> {
	let newCompletedQuests = new Array<object>()

	let alreadyCompletedQuestsMap = new Set<String>()
	alreadyCompletedQuests.map((i) => {
		let key = `${i.questId}-${i.identityId}`
		alreadyCompletedQuestsMap.add(key)
	})

	for (let quest of basicQuests) {
		if (quest.source != 'discord') continue
		for (let activity of basicAcitivity) {
			if (activity.activityType != quest.type) {
				continue
			}
			let key = `${quest.id}-${activity.identityId}`
			if (alreadyCompletedQuestsMap.has(key)) {
				continue
			}
			newCompletedQuests.push({
				questId: quest.id,
				guildId: activity.guildId,
				identityId: activity.identityId,
			})
			let progress = currentProgress.get(key)
			if (progress !== undefined) {
				progress.progress = 1
				await progress.save()
			} else {
				logger.warn('Basic quest has no progress for %s quest and %s identity', quest.id, activity.identityId)
			}
		}
	}

	return newCompletedQuests
}

async function processBattlepassDiscordQuests(
	battlepass: Battlepass,
	identityIds: number[],
	quests: Quest[],
	completedQuestsCount: Map<string, any>,
	questsProgress: Map<string, QuestProgress>,
	newCompletedQuests: any[]
) {
	let startDate = battlepass.startDate || new Date(),
		endDate = battlepass.endDate || new Date()
	let usersActivity = await getDiscordUsersActivity(identityIds, startDate, endDate)
	for (let quest of quests) {
		for (let identityId of identityIds) {
			let key = `${quest.id}-${identityId}`
			let completedCnt = completedQuestsCount.get(key) || 0
			let additionalNewQuests = await getCompletedQuestsForUser(
				identityId, quest, usersActivity,
				completedCnt, questsProgress
			)
			if (additionalNewQuests.length) {
				newCompletedQuests.push(...additionalNewQuests)
			}
		}
	}
}

async function processTwitterLikesQuests(
	battlepass: Battlepass,
	quests: Quest[],
	identityIds: number[],
	questsProgress: Map<string, QuestProgress>,
	completedQuestsCount: Map<string, any>,
	newCompletedQuests: any[]
) {
	let twitterUsers = await Identity.findAll({
		where: {
			id: identityIds,
			twitter: {
				[Op.ne]: null
			}
		},
		attributes: ['id', 'twitter']
	})
	let twitterUsersMap = new Map<string, number>()
	twitterUsers.map(i => {
		twitterUsersMap.set(i.twitter || '', i.id)
	})
	if (!twitterUsersMap) {
		return
	}
	let questsByAuthor = new Map<string, Quest[]>()
	quests.map(q => {
		let existing = questsByAuthor.get(q.twitterId || '')
		if (!existing) {
			existing = []
			questsByAuthor.set(q.twitterId || '', existing)
		}
		existing.push(q)
	})
	let where: any = {
		authorId: Array.from(twitterUsersMap.keys()),
		objectAuthor: Array.from(questsByAuthor.keys())
	}
	if (battlepass.endDate) {
		where['createdAt'] = {
			[Op.between]: [battlepass.startDate || new Date(), battlepass.endDate || new Date()]
		}
	} else {twitterUsers
		where['createdAt'] = {
			[Op.gte]: battlepass.startDate
		}
	}
	let activity = await TwitterActivity.findAll({
		where,
		group: ['authorId', 'objectAuthor'],
		attributes: [
			'authorId', 'objectAuthor',
			[sequelize.fn('count', '*'), 'likesCnt']
		]
	})
	for (let row of activity) {
		let authorId = row.authorId
		let tweetAuthor = row.objectAuthor
		let likesCnt: any = row.get('likesCnt')
		let identityId = twitterUsersMap.get(authorId)
		if (!identityId) {
			continue
		}
		let quests = questsByAuthor.get(tweetAuthor)
		if (!quests) {
			continue
		}
		for (let quest of quests) {
			let key = `${quest.id}-${identityId}`
			let currentProgress = questsProgress.get(key)
			if (!currentProgress) {
				logger.warn('Twitter quest %s has no progress for user %s', quest.id, identityId)
				continue
			}
			if (!quest.repeat && currentProgress.progress >= 1) {
				continue
			}
			let newProgress = parseFloat((likesCnt / quest.quantity).toFixed(2))
			if (newProgress > 1 && !quest.repeat) {
				newProgress = 1
			}
			if (newProgress <= currentProgress.progress) {
				continue
			}
			currentProgress.progress = newProgress
			await currentProgress.save()
			let completedCount = completedQuestsCount.get(key) || 0
			let newCompletedCount = Math.floor(newProgress)
			if (newCompletedCount > completedCount) {
				let item = {
					identityId: identityId,
					questId: quest.id
				}
				newCompletedQuests.push(...Array(newCompletedCount - completedCount).fill(item))
			}
		}
	}
}

async function processBattlepassTwitterQuests(
	battlepass: Battlepass,
	identityIds: number[],
	quests: Quest[],
	completedQuestsCount: Map<string, any>,
	questsProgress: Map<string, QuestProgress>,
	newCompletedQuests: any[]
) {
	let likeQuests = quests.filter(q => {
		return q.source === 'twitter' && q.type === 'like' && q.twitterId
	})
	if (likeQuests) {
		await processTwitterLikesQuests(
			battlepass, likeQuests,
			identityIds,questsProgress,
			completedQuestsCount, newCompletedQuests
		)
	}
}

export async function processBattlepassQuests(battlepass: Battlepass, identityIds: number[]) {
	let basicUsersActivity = await getBasicUsersActivity(identityIds)
	let quests = await getBattlepassQuests(battlepass.chainId)
	let completedQuests = await getCompletedQuests(quests.map((quest) => quest.id))
	let completedQuestsCount = new Map<string, any>()
	completedQuests.map((quest) => {
		let key = `${quest.questId}-${quest.identityId}`
		completedQuestsCount.set(key, quest.get('cnt'))
	})

	let basicQuests = new Array<Quest>()
	let regularDiscordQuests = new Array<Quest>()
	let regularTwitterQuests = new Array<Quest>()
	for (let quest of quests) {
		if (quest.type == 'connect' || quest.type == 'join') {
			basicQuests.push(quest)
		} else if (quest.source == 'discord') {
			regularDiscordQuests.push(quest)
		} else if (quest.source == 'twitter') {
			regularTwitterQuests.push(quest)
		}
	}
	let currentProgress = await getCurrentProgress(battlepass.id)
	let newCompletedQuests = await processBasicQuests(basicQuests, basicUsersActivity, completedQuests, currentProgress)
	await processBattlepassDiscordQuests(
		battlepass, identityIds, regularDiscordQuests,
		completedQuestsCount, currentProgress,
		newCompletedQuests
	)
	await processBattlepassTwitterQuests(
		battlepass, identityIds, regularTwitterQuests,
		completedQuestsCount, currentProgress, newCompletedQuests
	)
	if (newCompletedQuests.length) {
		logger.info('Saving %s completed quests', newCompletedQuests.length)
		await CompletedQuest.bulkCreate(newCompletedQuests)
	}
	if (!battlepass.active) {
		battlepass.finalized = true
		await battlepass.save()
	}
}
