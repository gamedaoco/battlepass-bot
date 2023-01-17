import { Op } from 'sequelize'
import { ApiPromise, WsProvider, Keyring } from '@polkadot/api'

import { config } from '../config'
import { logger } from '../logger'
import { Battlepass, Quest, CompletedQuest, DiscordActivity, Identity, ChainStatus, sequelize } from '../db'
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
				await Battlepass.findOrCreate({
					where: {
						chainId: bpId.toString(),
					},
					defaults: {
						chainId: bpId.toString(),
						startDate: calculateBlockDate(knownDate, knownBlock, header.number.toNumber()),
						orgId: orgId.toString(),
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

async function getBattlePassQuests(battlePassId: string): Promise<Quest[]> {
	return await Quest.findAll({
		where: {
			source: 'discord',
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

async function getUsersActivity(identities: number[], startDate: Date, endDate: Date): Promise<DiscordActivity[]> {
	return await DiscordActivity.findAll({
		attributes: [
			'IdentityId',
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
			IdentityId: identities,
		},
		group: ['date', 'IdentityId', 'guildId', 'channelId'],
		order: ['date', 'IdentityId'],
	})
}

async function getCompletedQuests(questIds: number[]) {
	return await CompletedQuest.findAll({
		attributes: ['QuestId', 'IdentityId', [sequelize.fn('count', '*'), 'cnt']],
		where: {
			QuestId: questIds,
		},
		group: ['QuestId', 'IdentityId'],
	})
}

function getCompletedQuestsForUser(identityId: number, quest: Quest, userActivity: any[], completedBefore: number) {
	if (!quest.repeat && completedBefore) {
		return []
	}
	let maxPerDay = quest.quantity
	if (quest.repeat) {
		maxPerDay *= quest.maxDaily || 1
	}
	let totalActivity = 0
	for (let activity of userActivity) {
		if (activity.get('IdentityId') != identityId) {
			continue
		}
		if (quest.channelId && activity.get('channelId') != quest.channelId) {
			continue
		}
		totalActivity += Math.min(maxPerDay, activity.get('messagesCnt'))
	}
	let completedCount = Math.floor(totalActivity / quest.quantity)
	if (!quest.repeat && completedCount > 1) {
		completedCount = 1
	}
	if (!completedCount || completedCount <= completedBefore) {
		return []
	}
	let record = {
		IdentityId: identityId,
		QuestId: quest.id,
		guildId: userActivity[0].guildId,
	}
	return Array(completedCount - completedBefore).fill(record)
}

function processBasicQuests(
	basicQuests: Quest[],
	basicAcitivity: DiscordActivity[],
	alreadyCompletedQuests: CompletedQuest[],
): Array<any> {
	let newCompletedQuests = new Array<object>()

	let alreadyCompletedQuestsMap = new Set<String>()
	alreadyCompletedQuests.map((i) => {
		let key = `${i.QuestId}-${i.IdentityId}`
		alreadyCompletedQuestsMap.add(key)
	})

	for (let quest of basicQuests) {
		if (quest.source != 'discord') continue
		for (let activity of basicAcitivity) {
			if (activity.activityType != quest.type) {
				continue
			}
			let key = `${quest.id}-${activity.IdentityId}`
			if (alreadyCompletedQuestsMap.has(key)) {
				continue
			}
			newCompletedQuests.push({
				QuestId: quest.id,
				guildId: activity.guildId,
				IdentityId: activity.IdentityId,
			})
		}
	}

	return newCompletedQuests
}

export async function processBattlepassQuests(battlepass: Battlepass, identityIds: number[]) {
	let startDate = battlepass.startDate || new Date(),
		endDate = battlepass.endDate || new Date()
	let basicUsersActivity = await getBasicUsersActivity(identityIds)
	let usersActivity = await getUsersActivity(identityIds, startDate, endDate)
	let quests = await getBattlePassQuests(battlepass.chainId)
	let completedQuests = await getCompletedQuests(quests.map((quest) => quest.id))
	let completedQuestsCount = new Map<string, any>()
	completedQuests.map((quest) => {
		let key = `${quest.QuestId}-${quest.IdentityId}`
		completedQuestsCount.set(key, quest.get('cnt'))
	})

	let basicQuests = new Array<Quest>()
	let regularQuests = new Array<Quest>()
	for (let quest of quests) {
		if (quest.source != 'discord') {
			continue
		}
		if (quest.type == 'connect' || quest.type == 'join') {
			basicQuests.push(quest)
		} else {
			regularQuests.push(quest)
		}
	}

	let newCompletedQuests = processBasicQuests(basicQuests, basicUsersActivity, completedQuests)
	for (let quest of regularQuests) {
		for (let identityId of identityIds) {
			let key = `${quest.id}-${identityId}`
			let completedCnt = completedQuestsCount.get(key) || 0
			let additionalNewQuests = getCompletedQuestsForUser(identityId, quest, usersActivity, completedCnt)
			if (additionalNewQuests.length) {
				newCompletedQuests.push(...additionalNewQuests)
			}
		}
	}
	if (newCompletedQuests.length) {
		logger.info('Saving %s completed quests', newCompletedQuests.length)
		await CompletedQuest.bulkCreate(newCompletedQuests)
	}
	if (!battlepass.active) {
		battlepass.finalized = true
		await battlepass.save()
	}
}
