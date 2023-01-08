import { describe, expect, test, it, beforeEach, beforeAll } from '@jest/globals';
import assert = require("assert")

import truncate from '../truncate';
import { initDB, sequelize, Identity, Battlepass, Quest, CompletedQuest, DiscordActivity } from '../../db';
import { processBattlepassQuests } from '../../chain/chain';


describe('Quests matching logic', () => {
	beforeAll(async () => {
	    await initDB();
	    await sequelize.sync({force: true});
	  });

	beforeEach(async () => {
	    await truncate();
	});

	test('Active battlepass, single quest, single user', async () => {
		let bp = await Battlepass.create({
			chainId: ''.padEnd(66, '1'),
			orgId: ''.padEnd(66, '2'),
			startDate: new Date('2023-01-01T11:50:00Z'),
			endDate: null,
			active: true,
			finalized: false
		});
		let identity1 = await Identity.create({
			discord: ''.padEnd(15, '3'),
			address: ''.padEnd(48, '3'),
		});
		let quest1 = await Quest.create({
			repeat: false,
		    source: 'discord',
		    type: 'post',
		    channelId: null,
		    quantity: 2,
		    points: 1000,
		    BattlepassId: bp.id
		});
		let activity1 = await DiscordActivity.create({
			guildId: ''.padEnd(15, '4'),
			channelId: ''.padEnd(20, '5'),
			activityId: ''.padEnd(20, '6'),
			activityType: 'post',
			createdAt: new Date('2023-01-01T11:55:00Z'),
			IdentityId: identity1.id
		});
		await DiscordActivity.create({
			guildId: ''.padEnd(15, '4'),
			channelId: null,
			activityId: ''.padEnd(20, '7'),
			activityType: 'post',
			createdAt: new Date('2023-01-01T11:56:00Z'),
			IdentityId: identity1.id
		});

		await processBattlepassQuests(bp, [identity1.address || '']);
		let completedQuests = await CompletedQuest.findAll();
		expect(completedQuests.length).toBe(1);
		expect(completedQuests[0].QuestId).toBe(quest1.id);
		expect(completedQuests[0].IdentityId).toBe(identity1.id);
		expect(completedQuests[0].guildId).toBe(activity1.guildId);
	});

	test('Inactive battlepass, single quest, single user', async () => {
		let bp = await Battlepass.create({
			chainId: ''.padEnd(66, '1'),
			orgId: ''.padEnd(66, '2'),
			startDate: null,
			endDate: null,
			active: false,
			finalized: true
		});
		let identity1 = await Identity.create({
			discord: ''.padEnd(15, '3'),
			address: ''.padEnd(48, '3'),
		});
		let quest1 = await Quest.create({
			repeat: false,
		    source: 'discord',
		    type: 'post',
		    channelId: null,
		    quantity: 2,
		    points: 1000,
		    BattlepassId: bp.id
		});
		let activity1 = await DiscordActivity.create({
			guildId: ''.padEnd(15, '4'),
			channelId: ''.padEnd(20, '5'),
			activityId: ''.padEnd(20, '6'),
			activityType: 'post',
			createdAt: new Date('2023-01-01T11:55:00Z'),
			IdentityId: identity1.id
		});
		await DiscordActivity.create({
			guildId: ''.padEnd(15, '4'),
			channelId: null,
			activityId: ''.padEnd(20, '7'),
			activityType: 'post',
			createdAt: new Date('2023-01-01T11:56:00Z'),
			IdentityId: identity1.id
		});

		await processBattlepassQuests(bp, [identity1.address || '']);
		let completedQuests = await CompletedQuest.findAll();
		expect(completedQuests.length).toBe(0);
	});

	test('Daily quest', async () => {
		let bp = await Battlepass.create({
			chainId: ''.padEnd(66, '1'),
			orgId: ''.padEnd(66, '2'),
			startDate: new Date('2023-01-01T11:50:00Z'),
			endDate: null,
			active: true,
			finalized: false
		});
		let identity1 = await Identity.create({
			discord: ''.padEnd(15, '3'),
			address: ''.padEnd(48, '3'),
		});
		let quest1 = await Quest.create({
			repeat: true,
		    source: 'discord',
		    type: 'post',
		    channelId: null,
		    quantity: 2,
		    points: 1000,
		    maxDaily: 2,
		    BattlepassId: bp.id
		});
		await DiscordActivity.bulkCreate([
			{
				guildId: ''.padEnd(15, '4'),
				channelId: ''.padEnd(20, '5'),
				activityId: ''.padEnd(20, '6'),
				activityType: 'post',
				createdAt: new Date('2023-01-01T11:55:00Z'),
				IdentityId: identity1.id
			},
			{
				guildId: ''.padEnd(15, '4'),
				channelId: ''.padEnd(20, '5'),
				activityId: ''.padEnd(20, '6'),
				activityType: 'post',
				createdAt: new Date('2023-01-01T11:55:01Z'),
				IdentityId: identity1.id
			},
			{
				guildId: ''.padEnd(15, '4'),
				channelId: ''.padEnd(20, '5'),
				activityId: ''.padEnd(20, '6'),
				activityType: 'post',
				createdAt: new Date('2023-01-01T11:55:02Z'),
				IdentityId: identity1.id
			},
			{
				guildId: ''.padEnd(15, '4'),
				channelId: ''.padEnd(20, '5'),
				activityId: ''.padEnd(20, '6'),
				activityType: 'post',
				createdAt: new Date('2023-01-01T11:55:03Z'),
				IdentityId: identity1.id
			},
			{
				guildId: ''.padEnd(15, '4'),
				channelId: ''.padEnd(20, '5'),
				activityId: ''.padEnd(20, '6'),
				activityType: 'post',
				createdAt: new Date('2023-01-01T11:55:04Z'),
				IdentityId: identity1.id
			},
			{
				guildId: ''.padEnd(15, '4'),
				channelId: ''.padEnd(20, '5'),
				activityId: ''.padEnd(20, '6'),
				activityType: 'post',
				createdAt: new Date('2023-01-01T11:55:05Z'),
				IdentityId: identity1.id
			},
		]);

		await processBattlepassQuests(bp, [identity1.address || '']);
		let completedQuests = await CompletedQuest.findAll();
		expect(completedQuests.length).toBe(2);
		expect(completedQuests[0].IdentityId).toBe(identity1.id);
		expect(completedQuests[1].IdentityId).toBe(identity1.id);
		expect(completedQuests[0].QuestId).toBe(quest1.id);
		expect(completedQuests[1].QuestId).toBe(quest1.id);
		expect(completedQuests[0].guildId).toBe(''.padEnd(15, '4'));
		expect(completedQuests[1].guildId).toBe(''.padEnd(15, '4'));
	});
});