import { Op } from 'sequelize';
import { ApiPromise, WsProvider, Keyring } from '@polkadot/api';

import { config } from '../config';
import { logger } from '../logger';
import { Battlepass, Quest, CompletedQuest, DiscordActivity, Identity, ChainStatus, sequelize } from '../db';
import { calculateBlockDate } from '../indexer/indexer';


export async function getActiveBattlePasses(): Promise<Map<string, Battlepass>> {
	let map = new Map<string, Battlepass>();
	let query = await Battlepass.findAll({
		where: {
			[Op.or]: [
				{active: true},
				{active: false, finalized: false},
			]
		}
	});
	query.map(item => {
		map.set(item.chainId, item);
	});
	return map;
}

export async function connectToNode(): Promise<ApiPromise> {
	const provider = new WsProvider(config.chain.rpcUrl);
	const api = await ApiPromise.create({ provider });
	if (!api.isConnected) {
		throw new Error('Failed to connect to chain RPC node.');
	}
	return api;
}

export async function listenNewEvents(api: ApiPromise, knownBlock: number, knownDate: Date) {
	await api.rpc.chain.subscribeNewHeads(async (header) => {
        const at = await api.at(header.hash);
        const events: any = await at.query.system.events();
        await events.forEach( async (record: any) => {
	 		let event = record.event;
	 		if (api.events.battlepass.BattlepassActivated.is(event)) {
	 			let [byWho, orgId, bpId] = event.data;
	 			await Battlepass.findOrCreate({
	 				where: {
	 					chainId: bpId.toString()
	 				},
	 				defaults: {
	 					chainId: bpId.toString(),
	 					startDate: calculateBlockDate(knownDate, knownBlock, header.number.toNumber()),
	 					orgId: orgId.toString(),
	 					active: true,
	 					finalized: false
	 				}
	 			});
	 			logger.debug('Found new active battlepass %s', bpId.toString());
	 		} else if (api.events.battlepass.BattlepassEnded.is(event)) {
	 			let [byWho, orgId, bpId] = event.data;
	 			let bp = await Battlepass.findOne({
	 				where: {chainId: bpId.toString()}
	 			});
	 			if (bp == null) {
	 				logger.error('Found chain event about finished unknown battlepass');
	 				return;
	 			}
	 			bp.endDate = calculateBlockDate(knownDate, knownBlock, header.number.toNumber());
	 			bp.active = false;
	 			await bp.save();
	 			logger.debug('Found ended battlepass %s', bpId.toString());
	 		}
	 	});
	 	await ChainStatus.update({blockNumber: header.number.toNumber()}, {where: {id: 1}});
    });
}

async function getBattlePassQuests(battlePassId: string): Promise<Array<Quest>> {
	return await Quest.findAll({
		include: [{
			model: Battlepass,
			required: true,
			where: {
				chainId: battlePassId
			}
		}]
	});
}

async function getUsersActivity(users: Array<string>, startDate: Date, endDate: Date): Promise<Array<DiscordActivity>> {
	return await DiscordActivity.findAll({
		include: [{
			model: Identity,
			required: true,
			where: {
				discord: users
			}
		}],
		attributes: [
			'identityId',
			'guildId',
			'channelName',
			[sequelize.fn('date', sequelize.col('createdAt')), 'date'],
			[sequelize.fn('count', '*'), 'messagesCnt']
		],
		where: {
			createdAt: {
				[Op.gte]: startDate,
				[Op.lte]: endDate
			},
			activityType: 'post'
		},
		group: [
			'date',
			'identityId',
			'guildId',
			'channelName'
		],
		order: [
			'date',
			'identityId'
		]
	});
}

async function getCompletedQuests(questIds: Array<number>) {
	return await CompletedQuest.findAll({
		attributes: [
			'questId',
			'identityId',
			[sequelize.fn('date', sequelize.col('createdAt')), 'date'],
			[sequelize.fn('count', '*'), 'cnt']
		],
		where: {
			QuestId: questIds
		},
		group: [
			'questId',
			'identityId',
			'date'
		]
	});
}

export async function processBattlepassQuests(battlepass: Battlepass, users: Array<string>) {
	let startDate = battlepass.startDate || new Date(), endDate = battlepass.startDate || new Date();
	let usersActivity = await getUsersActivity(users, startDate, endDate);
	let quests = await getBattlePassQuests(battlepass.chainId);
	logger.debug('Processing battlepass %s with %s quests and %s users', battlepass.chainId, quests.length, users.length);
	let completedQuests = await getCompletedQuests(quests.map(quest => quest.id));
	let questsByChannel = new Map<string | null, Array<Quest>>();
	quests.map(q => {
		let channel = questsByChannel.get(q.channelId);
		if (channel == undefined) {
			channel = new Array<Quest>();
			questsByChannel.set(q.channelId, channel);
		}
		channel.push(q);
	});
	// [questId, identityId, date]: how many times quest completed
	let completedQuestsMap = new Map<[number, number, any], any>();
	completedQuests.map(q => {
		completedQuestsMap.set([q.QuestId, q.IdentityId, q.get('date')], q.get('cnt'));
	});
	// [guildId, identityId, date]: number of messages for that date
	let totalMessages = new Map<[string, number, any], number>();
	let completedQuestsToCreate = new Array<CompletedQuest>();
	for (let item of usersActivity) {
		let identityId: number = item.identityId;
		let guildId: string = item.guildId;
		let channelId: string | null = item.channelId;
		let date: any = item.get('date');
		let messagesCnt: any = item.get('messagesCnt');

		let userTotalMessages = totalMessages.get([guildId, identityId, date]);
		if(userTotalMessages == undefined) {
			userTotalMessages = 0;
		}
		totalMessages.set([guildId, identityId, date], userTotalMessages + 1);

		let channelQuests = questsByChannel.get(channelId);
		if (channelQuests == undefined) {
			continue;
		}
		for (let quest of channelQuests) {
			processQuest(quest, messagesCnt, identityId, guildId, date, completedQuestsMap, completedQuestsToCreate);
		}
	};
	let generalQuests = questsByChannel.get(null);
	if (generalQuests != undefined) {
		for (let quest of generalQuests) {
			for (let [key, messagesCnt] of totalMessages) {
				let [guildId, identityId, date] = key;
				processQuest(quest, messagesCnt, identityId, guildId, date, completedQuestsMap, completedQuestsToCreate);
			}
		}
	}
	if (completedQuestsToCreate.length) {
		await CompletedQuest.bulkCreate(completedQuestsToCreate);
		logger.info('Saving %s completed quests', completedQuestsToCreate.length);
	}
	if (!battlepass.active) {
		battlepass.finalized = true;
		await battlepass.save();
	}
}

function processQuest(
	quest: Quest, messagesCnt: number, identityId: number, guildId: string,
	date: Date, completedQuestsMap: Map<[number, number, any], number>,
	completedQuestsToCreate: Array<Object>
) {
	let completedBefore = completedQuestsMap.get([quest.id, identityId, date]) || 0;
	if ((!quest.repeat && completedBefore >= 1) || (quest.repeat && (quest.maxDaily || 1) <= completedBefore)) {
		return;
	}
	if (quest.repeat) {
		let newCompleted = Math.max(Math.floor(messagesCnt / quest.quantity), quest.maxDaily || 1);
		if (newCompleted > completedBefore) {
			completedQuestsMap.set([quest.id, identityId, date], newCompleted);
			let entity = {
				guildId,
				identityId,
				questId: quest.id
			};
			completedQuestsToCreate.push(...Array(newCompleted - completedBefore).fill(entity));
		}
	} else {
		completedQuestsMap.set([quest.id, identityId, date], 1);
		completedQuestsToCreate.push({
			guildId,
			identityId,
			questId: quest.id
		});
	}
}