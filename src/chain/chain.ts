import { Op } from 'sequelize'
import { ApiPromise, WsProvider, Keyring } from '@polkadot/api'

import { config } from '../config'
import { logger } from '../logger'
import { Battlepass, Quest, CompletedQuest, DiscordActivity, Identity, ChainStatus, sequelize } from '../db'
import { calculateBlockDate } from '../indexer/indexer'

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

async function getBattlePassQuests(battlePassId: string): Promise<Array<Quest>> {
	return await Quest.findAll({
		include: [
			{
				model: Battlepass,
				required: true,
				where: {
					chainId: battlePassId,
				},
			},
		],
	})
}

async function getUsersActivity(
	chainUsers: Array<string>,
	participantIds: Array<number>,
	startDate: Date,
	endDate: Date,
): Promise<Array<DiscordActivity>> {
	return await DiscordActivity.findAll({
		include: [
			{
				model: Identity,
				required: true,
				attributes: [],
				where: {
					[Op.or]: [{ address: chainUsers }, { id: participantIds }],
					discord: {
						[Op.not]: null,
					},
				},
			},
		],
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
		},
		group: ['date', 'IdentityId', 'guildId', 'channelId'],
		order: ['date', 'IdentityId'],
	})
}

async function getCompletedQuests(questIds: Array<number>) {
	return await CompletedQuest.findAll({
		attributes: [
			'QuestId',
			'IdentityId',
			[sequelize.fn('date', sequelize.col('CompletedQuest.createdAt')), 'date'],
			[sequelize.fn('count', '*'), 'cnt'],
		],
		where: {
			QuestId: questIds,
		},
		group: ['QuestId', 'IdentityId', 'date'],
	})
}

export async function processBattlepassQuests(
	battlepass: Battlepass,
	chainUsers: Array<string>,
	participantIds: Array<number>,
) {
	let startDate = battlepass.startDate || new Date(),
		endDate = battlepass.endDate || new Date()
	let usersActivity = await getUsersActivity(chainUsers, participantIds, startDate, endDate)
	let quests = await getBattlePassQuests(battlepass.chainId)
	logger.debug(
		'Processing battlepass %s with %s quests and %s users',
		battlepass.chainId,
		quests.length,
		chainUsers.length + participantIds.length,
	)
	let completedQuests = await getCompletedQuests(quests.map((quest) => quest.id))
	let questsByChannel = new Map<string | null, Array<Quest>>()
	quests.map((q) => {
		let channel = questsByChannel.get(q.channelId)
		if (channel == undefined) {
			channel = new Array<Quest>()
			questsByChannel.set(q.channelId, channel)
		}
		channel.push(q)
	})
	// [questId, identityId, date]: how many times quest completed
	let completedQuestsMap = new Map<string, any>()
	completedQuests.map((q) => {
		completedQuestsMap.set(getMapKey([q.QuestId, q.IdentityId, q.get('date')]), q.get('cnt'))
	})
	// [guildId, identityId, date]: number of messages for that date
	let totalMessages = new Map<string, number>()
	let completedQuestsToCreate = new Array<CompletedQuest>()
	for (let item of usersActivity) {
		let identityId: number = item.IdentityId
		let guildId: string = item.guildId
		let channelId: string | null = item.channelId
		let date: any = item.get('date')
		let messagesCnt: any = item.get('messagesCnt')

		let userTotalMessages = totalMessages.get(getMapKey([guildId, identityId, date]))
		if (userTotalMessages == undefined) {
			userTotalMessages = 0
		}
		totalMessages.set(getMapKey([guildId, identityId, date]), userTotalMessages + messagesCnt)

		let channelQuests = questsByChannel.get(channelId)
		if (channelQuests == undefined) {
			continue
		}
		for (let quest of channelQuests) {
			processQuest(quest, messagesCnt, identityId, guildId, date, completedQuestsMap, completedQuestsToCreate)
		}
	}
	let generalQuests = questsByChannel.get(null)
	if (generalQuests != undefined) {
		for (let quest of generalQuests) {
			for (let [key, messagesCnt] of totalMessages) {
				let [guildId, identityId, date] = JSON.parse(key)
				processQuest(quest, messagesCnt, identityId, guildId, date, completedQuestsMap, completedQuestsToCreate)
			}
		}
	}
	if (completedQuestsToCreate.length) {
		logger.info('Saving %s completed quests', completedQuestsToCreate.length)
		await CompletedQuest.bulkCreate(completedQuestsToCreate)
	}
	if (!battlepass.active) {
		battlepass.finalized = true
		await battlepass.save()
	}
}

function processQuest(
	quest: Quest,
	messagesCnt: number,
	identityId: number,
	guildId: string,
	date: Date,
	completedQuestsMap: Map<string, number>,
	completedQuestsToCreate: Array<Object>,
) {
	let completedBefore = completedQuestsMap.get(getMapKey([quest.id, identityId, date])) || 0
	if ((!quest.repeat && completedBefore >= 1) || (quest.repeat && (quest.maxDaily || 1) <= completedBefore)) {
		return
	}
	if (quest.repeat) {
		let newCompleted = Math.min(Math.floor(messagesCnt / quest.quantity), quest.maxDaily || 1)
		if (newCompleted > completedBefore) {
			completedQuestsMap.set(getMapKey([quest.id, identityId, date]), newCompleted)
			let entity = {
				guildId,
				IdentityId: identityId,
				QuestId: quest.id,
			}
			completedQuestsToCreate.push(...Array(newCompleted - completedBefore).fill(entity))
		}
	} else {
		completedQuestsMap.set(getMapKey([quest.id, identityId, date]), 1)
		completedQuestsToCreate.push({
			guildId,
			IdentityId: identityId,
			QuestId: quest.id,
		})
	}
}

function getMapKey(key: Array<any>) {
	return JSON.stringify(key)
}
