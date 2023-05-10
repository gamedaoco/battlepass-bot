import { Op } from 'sequelize'
import { ApiPromise, WsProvider, Keyring } from '@polkadot/api'

import { config } from '../config'
import { logger } from '../logger'
import { getQueue } from '../queue'
import {
	Battlepass,
	Quest,
	QuestProgress,
	CompletedQuest,
	DiscordActivity,
	TwitterActivity,
	ChainActivity,
	Identity,
	ChainStatus,
	BattlepassLevel,
	BattlepassParticipant,
	BattlepassReward,
	RewardClaim,
	Payment,
	sequelize,
} from '../db'
import { calculateBlockDate } from '../indexer/indexer'

export async function listenNewEvents(api: ApiPromise, knownBlock: number, knownDate: Date) {
	await api.rpc.chain.subscribeNewHeads(async (header) => {
		const at = await api.at(header.hash)
		const events: any = await at.query.system.events()
		await events.forEach(async (record: any) => {
			let event = record.event
			if (api.events.battlepass.BattlepassCreated.is(event)) {
				let [orgId, bpId, season] = event.data
				const chainBp: any = await api.query.battlepass.battlepasses(bpId.toString())
				const bpState: any = await api.query.battlepass.battlepassStates(bpId.toString())
				await Battlepass.create({
					chainId: bpId.toString(),
					startDate: null,
					orgId: orgId.toString(),
					name: chainBp ? Buffer.from(chainBp.value.name, 'hex').toString() : null,
					cid: chainBp ? Buffer.from(chainBp.value.cid, 'hex').toString() : null,
					price: chainBp ? parseInt(chainBp.value.price?.toString()) : null,
					season: parseInt(season.toString()),
					active: false,
					// correct?
					state: bpState ? Buffer.from(bpState.value, 'hex').toString() : 'DRAFT',
					finalized: false,
				})
				logger.info('Found new battlepass %s', bpId.toString())
			} else if (api.events.battlepass.BattlepassActivated.is(event)) {
				let [byWho, orgId, bpId] = event.data
				const chainBp: any = await api.query.battlepass.battlepasses(bpId.toString())
				let [bp, created] = await Battlepass.findOrCreate({
					where: {
						chainId: bpId.toString(),
					},
					defaults: {
						chainId: bpId.toString(),
						startDate: calculateBlockDate(knownDate, knownBlock, header.number.toNumber()),
						orgId: orgId.toString(),
						name: chainBp ? Buffer.from(chainBp.value.name, 'hex').toString() : null,
						cid: chainBp ? Buffer.from(chainBp.value.cid, 'hex').toString() : null,
						active: true,
						// correct? should be derived from chain...
						state: 'DRAFT',
						finalized: false,
					},
				})
				if (!created) {
					bp.startDate = calculateBlockDate(knownDate, knownBlock, header.number.toNumber())
					bp.active = true
					// correct? should be derived from chain...
					bp.state = 'ACTIVE'
					bp.finalized = false
					await bp.save()
				}
				logger.info('Activating battlepass %s', bpId.toString())
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
				// correct? should be derived from chain...
				bp.state = 'ENDED'
				await bp.save()
				logger.info('Found ended battlepass %s', bpId.toString())
			} else if (api.events.battlepass.BattlepassClaimed.is(event)) {
				let [byWho, forWho, orgId, bpId, nftId] = event.data
				let bp = await Battlepass.findOne({
					where: { chainId: bpId.toString() },
				})
				if (bp == null) {
					logger.error('Found chain event about claimed unknown battlepass')
					return
				}
				let [identity, _] = await Identity.findOrCreate({
					where: { address: forWho.toString() },
				})
				let participant: any = await BattlepassParticipant.findOne({
					where: {
						identityId: identity.id,
						battlepassId: bp.id
					},
					include: [{
						model: Payment,
						required: false,
					}]
				})
				if (participant) {
					participant.premium = true
					participant.status = 'synced'
					participant.passChainId = nftId.toString()
					logger.info(
						'Updating participant status to premium for user %s and battlepass %s',
						identity.address,
						bp.chainId
					)
					await participant.save()
				} else {
					participant = await BattlepassParticipant.create({
						identityId: identity.id,
						battlepassId: bp.id,
						premium: true,
						status: 'synced',
						passChainId: nftId.toString()
					})
					let quests = await Quest.findAll({
						where: { battlepassId: bp.id },
					})
					if (quests.length) {
						let newProgress: any = []
						quests.map((q) => {
							newProgress.push({
								questId: q.id,
								identityId: identity.id,
								progress: 0,
							})
						})
						logger.info(
							'Creating new progress records for user %s and battlepass %s',
							identity.address,
							bp.chainId,
						)
						await QuestProgress.bulkCreate(newProgress)
					}
				}
				if (participant && participant.Payment) {
					await Battlepass.increment({ premiumClaimed: 1 }, { where: { id: bp.id } })
				} else {
					await Battlepass.increment({ freeClaimed: 1 }, { where: { id: bp.id } })
				}
			} else if (api.events.identity.IdentitySet.is(event)) {
                let address = event.data[0].toString()
                await ChainActivity.create({ address, activityType: 'identity' })
                logger.info('Identity set activity for address %s', address)
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
			source: ['discord', 'twitter', 'gamedao'],
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

async function getBasicUsersActivity(discordIds: string[]): Promise<DiscordActivity[]> {
	return await DiscordActivity.findAll({
		where: {
			activityType: ['connect', 'join'],
			discordId: discordIds
		},
	})
}

async function getDiscordUsersActivity(
	discordIds: string[],
	startDate: Date,
	endDate: Date,
): Promise<DiscordActivity[]> {
	return await DiscordActivity.findAll({
		attributes: [
			'discordId',
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
			discordId: discordIds,
		},
		group: ['date', 'discordId', 'guildId', 'channelId'],
		order: ['date', 'discordId'],
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
		include: [
			{
				model: Quest,
				required: true,
				attributes: [],
				where: {
					battlepassId,
				},
			},
		],
	})
	let map = new Map<string, QuestProgress>()
	res.map((i) => {
		let key = `${i.questId}-${i.identityId}`
		map.set(key, i)
	})
	return map
}

async function getCompletedQuestsForUser(
	discordId: string,
	identity: Identity,
	quest: Quest,
	userActivity: any[],
	completedBefore: number,
	currentProgress: Map<string, QuestProgress>,
	dailyCounts: Map<string, number>,
) {
	if (!quest.repeat && completedBefore) {
		return []
	}
	let maxPerDay = quest.quantity
	if (quest.repeat) {
		maxPerDay *= (quest.maxDaily || quest.max || 1)
	}
	let totalActivity = 0
	for (let activity of userActivity) {
		if (activity.get('discordId') != discordId) {
			continue
		}
		if (quest.guildId && activity.get('guildId') != quest.guildId) {
			continue
		}
		if (quest.channelId && activity.get('channelId') != quest.channelId) {
			continue
		}
		let dateKey = `${activity.get('date')}-${quest.id}-${activity.get('discordId')}`
		let dateCount = dailyCounts.get(dateKey) || 0
		if (dateCount >= maxPerDay) {
			continue
		}
		let cnt = parseInt(activity.get('messagesCnt')) || 0
		if (cnt > maxPerDay) {
			cnt = maxPerDay
		}
		if ((dateCount + cnt) > maxPerDay) {
			cnt = maxPerDay - dateCount
		}
		totalActivity += cnt
		dateCount += cnt
		dailyCounts.set(dateKey, dateCount)
	}
	let progressBefore = currentProgress.get(`${quest.id}-${identity.id}`)
	let progressNew = parseFloat((totalActivity / quest.quantity).toFixed(2))
	if (progressNew > 1 && !quest.repeat) {
		progressNew = 1
	} else if (quest.max && progressNew > quest.max) {
		progressNew = quest.max
	}
	if (progressBefore !== undefined) {
		if (progressNew != progressBefore.progress) {
			progressBefore.progress = progressNew
			await progressBefore.save()
		}
	} else {
		logger.warn('Current quest progress not specified for quest %s and identity %s', quest.id, identity.id)
	}
	let completedCount = Math.floor(progressNew)
	if (!quest.repeat && completedCount > 1) {
		completedCount = 1
	}
	if (!completedCount || completedCount <= completedBefore) {
		return []
	}
	let record = {
		identityId: identity.id,
		questId: quest.id,
		guildId: userActivity[0].guildId,
	}
	let newRecords = Array(completedCount - completedBefore).fill(record)
	await BattlepassParticipant.increment(
		{ points: quest.points * newRecords.length },
		{ where: {
			identityId: identity.id,
			battlepassId: quest.battlepassId
		}
	})
	return newRecords
}

async function processBasicQuests(
	identities: Map<string, Identity>,
	basicQuests: Quest[],
	basicAcitivity: DiscordActivity[],
	alreadyCompletedQuests: CompletedQuest[],
	currentProgress: Map<string, QuestProgress>,
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
			if (quest.guildId && quest.guildId != activity.guildId) {
				continue
			}
			let identity = identities.get(activity.discordId)
			if (!identity) {
				logger.debug('Basic discord activity without id value')
				continue
			}
			let key = `${quest.id}-${identity.id}`
			if (alreadyCompletedQuestsMap.has(key)) {
				continue
			}
			newCompletedQuests.push({
				questId: quest.id,
				guildId: activity.guildId,
				identityId: identity.id,
			})
			let progress = currentProgress.get(key)
			if (progress !== undefined) {
				progress.progress = 1
				await progress.save()
				await BattlepassParticipant.increment(
					{ points: quest.points },
					{ where: {
						identityId: identity.id,
						battlepassId: quest.battlepassId
					}
				})
			} else {
				logger.warn('Basic quest has no progress for %s quest and %s identity', quest.id, identity.id)
			}
		}
	}

	return newCompletedQuests
}

async function processBattlepassDiscordQuests(
	battlepass: Battlepass,
	identities: Map<string, Identity>, // discord id: identity
	quests: Quest[],
	completedQuestsCount: Map<string, any>,
	questsProgress: Map<string, QuestProgress>,
	newCompletedQuests: any[],
) {
	let startDate = battlepass.startDate || new Date(),
		endDate = battlepass.endDate || new Date()
	let dailyCounts = new Map<string, number>() // date-questId-discordId: count
	let usersActivity = await getDiscordUsersActivity(Array.from(identities.keys()), startDate, endDate)
	for (let quest of quests) {
		for (let [discordId, identity] of identities) {
			let key = `${quest.id}-${identity.id}`
			let completedCnt = completedQuestsCount.get(key) || 0
			let additionalNewQuests = await getCompletedQuestsForUser(
				discordId,
				identity,
				quest,
				usersActivity,
				completedCnt,
				questsProgress,
				dailyCounts
			)
			if (additionalNewQuests.length) {
				newCompletedQuests.push(...additionalNewQuests)
			}
		}
	}
}

async function processBattlepassTwitterQuests(
	battlepass: Battlepass,
	identities: Map<string, Identity>,
	quests: Quest[],
	completedQuestsCount: Map<string, any>,
	questsProgress: Map<string, QuestProgress>,
	newCompletedQuests: any[],
) {
	let twitterAuthors = new Set<string>()
	let tweetIds = new Set<string>()
	let questsMap = new Map<string, Quest[]>()
	let questById = new Map<number, Quest>()
	let tweetPattern = /^\d+$/
	quests.map((q) => {
		if (q.twitterId) {
			if (tweetPattern.test(q.twitterId)) {
				tweetIds.add(q.twitterId)
			} else {
				twitterAuthors.add(q.twitterId)
			}
		}
		let key = `${q.type}-${q.twitterId || ''}`
		let localQuests = questsMap.get(key)
		if (!localQuests) {
			localQuests = new Array<Quest>()
			questsMap.set(key, localQuests)
		}
		localQuests.push(q)
		questById.set(q.id, q)
	})
	if (!twitterAuthors.size && !tweetIds.size) {
		return
	}
	let activities = await TwitterActivity.findAll({
		where: {
			[Op.or]: [
				{
					activityType: 'connect'
				},
				{
					createdAt: {
						[Op.between]: [battlepass.startDate || new Date(), battlepass.endDate || new Date()],
					},
					activityType: {
						[Op.ne]: 'tweet',
					},
					authorId: Array.from(identities.keys()),
					[Op.or]: [
						{ objectAuthor: Array.from(twitterAuthors.values()) },
						{ objectId: Array.from(tweetIds.values()) },
					]
				}
			]
		},
		group: ['authorId', 'objectId', 'objectAuthor', 'activityType'],
		attributes: [
			'authorId',
			'objectId',
			'objectAuthor',
			'activityType',
			[sequelize.fn('count', '*'), 'activityCnt'],
		],
	})
	let newProgress = new Map<string, number>()
	for (let summary of activities) {
		let activityType = summary.activityType
		let objectAuthor = summary.objectAuthor
		let objectId = summary.objectId
		let activityCnt: any = summary.get('activityCnt')
		let authorId = summary.authorId || ''
		let activityQuests = questsMap.get(`${activityType}-${(objectAuthor ? objectAuthor : objectId) || ''}`)
		if (!activityQuests) {
			continue
		}
		let identity = identities.get(authorId)
		if (!identity) {
			continue
		}
		for (let quest of activityQuests) {
			let key = `${quest.id}-${identity.id}`
			let newQuestProgress = newProgress.get(key)
			if (!newQuestProgress) {
				newQuestProgress = 0
			}
			if (quest.max && newQuestProgress >= quest.max) {
				continue
			}
			newQuestProgress = (newQuestProgress * quest.quantity + parseInt(activityCnt)) / quest.quantity
			if (quest.max && newQuestProgress > quest.max) {
				newQuestProgress = quest.max
			} else if (!quest.repeat && newQuestProgress > 1) {
				newQuestProgress = 1
			}
			newProgress.set(key, newQuestProgress)
		}
	}
	for (let [progressKey, progressValue] of newProgress) {
		let questProgress = questsProgress.get(progressKey)
		if (questProgress === undefined) {
			logger.warn('No progress object found for quest identifier %s', progressKey)
			continue
		}
		progressValue = parseFloat(progressValue.toFixed(2))
		if (progressValue > questProgress.progress) {
			questProgress.progress = progressValue
			await questProgress.save()
			let completedValue = Math.floor(progressValue)
			let completedBeforeValue = completedQuestsCount.get(progressKey) || 0
			if (completedValue > completedBeforeValue) {
				let [questId, identityId] = progressKey.split('-')
				let item = {
					questId: parseInt(questId),
					identityId: parseInt(identityId),
				}
				let quest = questById.get(item.questId)
				if (quest) {
					await BattlepassParticipant.increment(
						{ points: quest.points * (completedValue - completedBeforeValue) },
						{ where: { identityId: item.identityId, battlepassId: battlepass.id } }
					)
				} else {
					logger.warn('Failed to increment points for identity %s and quest %s', identityId, questId)
				}
				newCompletedQuests.push(...Array(completedValue - completedBeforeValue).fill(item))
			}
		}
	}
}

async function processBattlepassChainQuests(
	battlepass: Battlepass,
	identities: Map<string, Identity>,
	quests: Quest[],
	completedQuestsCount: Map<string, any>,
	questsProgress: Map<string, QuestProgress>,
	newCompletedQuests: any[],
) {
	let activities = await ChainActivity.findAll({
		where: {
			address: Array.from(identities.keys()),
			activityType: ['connect', 'identity']
		}
	})
	let activitiesByType = new Map<string, ChainActivity[]>()
	activities.map((i) => {
		let key = i.activityType
		let typeActivities = activitiesByType.get(key)
		if (!typeActivities) {
			typeActivities = new Array<ChainActivity>()
			activitiesByType.set(key, typeActivities)
		}
		typeActivities.push(i)
	})
	for (let quest of quests) {
		let key = quest.type
		let questActivities = activitiesByType.get(key)
		if (!questActivities || !questActivities.length) {
			continue
		}
		for (let activity of questActivities) {
			let identity = identities.get(activity.address)
			if (!identity) {
				logger.debug('Chain activity address undefined')
				continue
			}
			let questKey = `${quest.id}-${identity.id}`
			let progress = questsProgress.get(questKey)
			if (!progress) {
				logger.warn('Quest %s has no progress assigned', questKey)
				continue
			}
			if (progress.progress == 1) {
				continue
			}
			progress.progress = 1
			await progress.save()
			newCompletedQuests.push({
				questId: quest.id,
				identityId: identity.id
			})
			await BattlepassParticipant.increment(
				{ points: quest.points },
				{ where: {
					identityId: identity.id,
					battlepassId: battlepass.id
				}
			})
		}
	}
}

export async function processBattlepassQuests(battlepass: Battlepass, identities: Identity[]) {
	let discordIds = new Map<string, Identity>()
	let twitterIds = new Map<string, Identity>()
	let chainIds = new Map<string, Identity>()
	identities.map(i => {
		if (i.discord) {
			discordIds.set(i.discord, i)
		}
		if (i.twitter) {
			twitterIds.set(i.twitter, i)
		}
		if (i.address) {
			chainIds.set(i.address, i)
		}
	})
	let basicUsersActivity = await getBasicUsersActivity(Array.from(discordIds.keys()))
	let quests = await getBattlepassQuests(battlepass.chainId)
	let completedQuests = await getCompletedQuests(quests.map((quest) => quest.id))
	let completedQuestsCount = new Map<string, any>()
	completedQuests.map((quest) => {
		let key = `${quest.questId}-${quest.identityId}`
		completedQuestsCount.set(key, quest.get('cnt'))
	})

	let basicQuests = new Array<Quest>()
	let basicChainQuests = new Array<Quest>()
	let regularDiscordQuests = new Array<Quest>()
	let regularTwitterQuests = new Array<Quest>()
	for (let quest of quests) {
		if (quest.source == 'discord' && (quest.type == 'connect' || quest.type == 'join')) {
			basicQuests.push(quest)
		} else if (quest.source == 'gamedao') {
			basicChainQuests.push(quest)
		} else if (quest.source == 'discord') {
			regularDiscordQuests.push(quest)
		} else if (quest.source == 'twitter') {
			regularTwitterQuests.push(quest)
		}
	}
	let currentProgress = await getCurrentProgress(battlepass.id)
	let newCompletedQuests = await processBasicQuests(discordIds, basicQuests, basicUsersActivity, completedQuests, currentProgress)
	if (discordIds.size) {
		await processBattlepassDiscordQuests(
			battlepass,
			discordIds,
			regularDiscordQuests,
			completedQuestsCount,
			currentProgress,
			newCompletedQuests,
		)
	}
	if (twitterIds.size) {
		await processBattlepassTwitterQuests(
			battlepass,
			twitterIds,
			regularTwitterQuests,
			completedQuestsCount,
			currentProgress,
			newCompletedQuests,
		)
	}
	if (chainIds.size) {
		await processBattlepassChainQuests(
			battlepass,
			chainIds,
			basicChainQuests,
			completedQuestsCount,
			currentProgress,
			newCompletedQuests,
		)
	}
	if (newCompletedQuests.length) {
		logger.info('Saving %s completed quests', newCompletedQuests.length)
		await CompletedQuest.bulkCreate(newCompletedQuests)
		let updatedIdentityIds = new Set<string>()
		for (let q of newCompletedQuests) {
			updatedIdentityIds.add(q.identityId)
		}
		let chainUsers = await BattlepassParticipant.findAll({
			where: { premium: true },
			attributes: ['identityId'],
			include: [{
				model: Identity,
				required: true,
				attributes: [],
				where: {
					id: Array.from(updatedIdentityIds.values()),
					address: { [Op.ne]: null }
				}
			}]
		})
		if (chainUsers.length) {
			logger.debug('Queueing points update')
			let queue = getQueue('chain')
			for (let i of chainUsers) {
				await queue.add(
					'points',
					{ type: 'points', identityId: i.identityId, battlepassId: battlepass.id },
					{ jobId: `points-${battlepass.chainId}-${i.identityId}` }
				)
			}
		} else {
			logger.debug('No chain user points to sync')
		}
	}
	if (!battlepass.active) {
		battlepass.finalized = true
		await battlepass.save()
	}
}
