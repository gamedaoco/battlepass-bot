import { describe, expect, test, it, beforeEach, beforeAll } from '@jest/globals'
import assert = require('assert')

import truncate from '../truncate'
import {
	initDB,
	sequelize,
	Identity,
	Battlepass,
	BattlepassParticipant,
	Quest,
	QuestProgress,
	CompletedQuest,
	DiscordActivity,
} from '../../db'
import { processBattlepassQuests } from '../../chain/chain'

describe('Quests matching logic', () => {
	beforeAll(async () => {
		await initDB()
		await sequelize.sync({ force: true })
	})

	beforeEach(async () => {
		await truncate()
	})

	test('Active battlepass, single user', async () => {
		let bp = await Battlepass.create({
			chainId: ''.padEnd(66, '1'),
			orgId: ''.padEnd(66, '2'),
			startDate: new Date('2023-01-01T11:50:00Z'),
			endDate: null,
			active: true,
			finalized: false,
		})
		let identity1 = await Identity.create({
			discord: ''.padEnd(15, '3'),
			address: ''.padEnd(48, '3'),
		})
		let [quest1, quest2, quest3] = await Quest.bulkCreate([
			{
				repeat: false,
				source: 'discord',
				type: 'connect',
				channelId: null,
				quantity: 1,
				points: 3000,
				battlepassId: bp.id,
			},
			{
				repeat: false,
				source: 'discord',
				type: 'join',
				channelId: null,
				quantity: 1,
				points: 3000,
				battlepassId: bp.id,
			},
			{
				repeat: false,
				source: 'discord',
				type: 'post',
				channelId: null,
				quantity: 2,
				points: 1000,
				battlepassId: bp.id,
			},
		])
		await QuestProgress.bulkCreate([
			{
				questId: quest1.id,
				identityId: identity1.id,
				progress: 0,
			},
			{
				questId: quest2.id,
				identityId: identity1.id,
				progress: 0,
			},
			{
				questId: quest3.id,
				identityId: identity1.id,
				progress: 0,
			},
		])
		let [activity1, activity2, activity3, activity4] = await DiscordActivity.bulkCreate([
			{
				guildId: ''.padEnd(15, '4'),
				channelId: null,
				activityId: '',
				activityType: 'connect',
				createdAt: new Date('2022-08-09T10:11:12Z'),
				discordId: identity1.discord || '',
			},
			{
				guildId: ''.padEnd(15, '4'),
				channelId: null,
				activityId: '',
				activityType: 'join',
				createdAt: new Date('2022-08-09T10:11:12Z'),
				discordId: identity1.discord || '',
			},
			{
				guildId: ''.padEnd(15, '4'),
				channelId: ''.padEnd(20, '5'),
				activityId: ''.padEnd(20, '6'),
				activityType: 'post',
				createdAt: new Date('2023-01-01T11:55:00Z'),
				discordId: identity1.discord || '',
			},
			{
				guildId: ''.padEnd(15, '4'),
				channelId: ''.padEnd(20, '7'),
				activityId: ''.padEnd(20, '8'),
				activityType: 'post',
				createdAt: new Date('2023-01-01T11:56:00Z'),
				discordId: identity1.discord || '',
			},
		])

		await processBattlepassQuests(bp, [identity1])
		let completedQuests = await CompletedQuest.findAll()
		expect(completedQuests.length).toBe(3)
		expect(completedQuests[0].questId).toBe(quest1.id)
		expect(completedQuests[0].identityId).toBe(identity1.id)
		expect(completedQuests[0].guildId).toBe(activity1.guildId)
		expect(completedQuests[1].questId).toBe(quest2.id)
		expect(completedQuests[1].identityId).toBe(identity1.id)
		expect(completedQuests[1].guildId).toBe(activity2.guildId)
		expect(completedQuests[2].questId).toBe(quest3.id)
		expect(completedQuests[2].identityId).toBe(identity1.id)
		expect(completedQuests[2].guildId).toBe(activity3.guildId)

		let progress = await QuestProgress.findAll()
		expect(progress.length).toBe(3)
		expect(progress[0].progress).toBe(1)
		expect(progress[1].progress).toBe(1)
		expect(progress[2].progress).toBe(1)

		await processBattlepassQuests(bp, [identity1])
		let newCompletedQuestsCount = await CompletedQuest.count()
		expect(newCompletedQuestsCount).toBe(completedQuests.length)
	})

	test('Inactive battlepass, single quest, single user', async () => {
		let bp = await Battlepass.create({
			chainId: ''.padEnd(66, '1'),
			orgId: ''.padEnd(66, '2'),
			startDate: null,
			endDate: null,
			active: false,
			finalized: true,
		})
		let identity1 = await Identity.create({
			discord: ''.padEnd(15, '3'),
			address: ''.padEnd(48, '3'),
		})
		let quest1 = await Quest.create({
			repeat: false,
			source: 'discord',
			type: 'post',
			channelId: null,
			quantity: 2,
			points: 1000,
			battlepassId: bp.id,
		})
		await QuestProgress.create({
			questId: quest1.id,
			identityId: identity1.id,
			progress: 0,
		})
		let activity1 = await DiscordActivity.create({
			guildId: ''.padEnd(15, '4'),
			channelId: ''.padEnd(20, '5'),
			activityId: ''.padEnd(20, '6'),
			activityType: 'post',
			createdAt: new Date('2023-01-01T11:55:00Z'),
			discordId: identity1.discord || '',
		})
		await DiscordActivity.create({
			guildId: ''.padEnd(15, '4'),
			channelId: ''.padEnd(20, '5'),
			activityId: ''.padEnd(20, '7'),
			activityType: 'post',
			createdAt: new Date('2023-01-01T11:56:00Z'),
			discordId: identity1.discord || '',
		})

		await processBattlepassQuests(bp, [identity1])
		let completedQuests = await CompletedQuest.findAll()
		expect(completedQuests.length).toBe(0)
	})

	test('Daily quest', async () => {
		let bp = await Battlepass.create({
			chainId: ''.padEnd(66, '1'),
			orgId: ''.padEnd(66, '2'),
			startDate: new Date('2023-01-01T11:50:00Z'),
			endDate: null,
			active: true,
			finalized: false,
		})
		let [identity1, identity2] = await Identity.bulkCreate([
			{
				discord: ''.padEnd(15, '3'),
				address: ''.padEnd(48, '3'),
			},
			{
				discord: ''.padEnd(15, '4'),
			},
		])
		await BattlepassParticipant.create({
			battlepassId: bp.id,
			identityId: identity2.id,
			premium: false
		})
		let quest1 = await Quest.create({
			repeat: true,
			source: 'discord',
			type: 'post',
			channelId: null,
			quantity: 2,
			points: 1000,
			maxDaily: 2,
			battlepassId: bp.id,
		})
		await QuestProgress.bulkCreate([
			{
				questId: quest1.id,
				identityId: identity1.id,
				progress: 0,
			},
			{
				questId: quest1.id,
				identityId: identity2.id,
				progress: 0,
			},
		])
		await DiscordActivity.bulkCreate([
			{
				guildId: ''.padEnd(15, '4'),
				channelId: ''.padEnd(20, '5'),
				activityId: ''.padEnd(20, '6'),
				activityType: 'post',
				createdAt: new Date('2023-01-01T11:55:00Z'),
				discordId: identity1.discord || '',
			},
			{
				guildId: ''.padEnd(15, '4'),
				channelId: ''.padEnd(20, '5'),
				activityId: ''.padEnd(20, '6'),
				activityType: 'post',
				createdAt: new Date('2023-01-01T11:55:01Z'),
				discordId: identity1.discord || '',
			},
			{
				guildId: ''.padEnd(15, '4'),
				channelId: ''.padEnd(20, '5'),
				activityId: ''.padEnd(20, '6'),
				activityType: 'post',
				createdAt: new Date('2023-01-01T11:55:02Z'),
				discordId: identity1.discord || '',
			},
			{
				guildId: ''.padEnd(15, '4'),
				channelId: ''.padEnd(20, '5'),
				activityId: ''.padEnd(20, '6'),
				activityType: 'post',
				createdAt: new Date('2023-01-01T11:55:03Z'),
				discordId: identity1.discord || '',
			},
			{
				guildId: ''.padEnd(15, '4'),
				channelId: ''.padEnd(20, '5'),
				activityId: ''.padEnd(20, '6'),
				activityType: 'post',
				createdAt: new Date('2023-01-01T11:55:04Z'),
				discordId: identity1.discord || '',
			},
			{
				guildId: ''.padEnd(15, '4'),
				channelId: ''.padEnd(20, '5'),
				activityId: ''.padEnd(20, '6'),
				activityType: 'post',
				createdAt: new Date('2023-01-01T11:55:05Z'),
				discordId: identity1.discord || '',
			},
			{
				guildId: ''.padEnd(15, '4'),
				channelId: ''.padEnd(20, '5'),
				activityId: ''.padEnd(20, '6'),
				activityType: 'post',
				createdAt: new Date('2023-01-01T11:55:06Z'),
				discordId: identity2.discord || '',
			},
			{
				guildId: ''.padEnd(15, '4'),
				channelId: ''.padEnd(20, '5'),
				activityId: ''.padEnd(20, '6'),
				activityType: 'post',
				createdAt: new Date('2023-01-01T11:55:07Z'),
				discordId: identity2.discord || '',
			},
		])

		await processBattlepassQuests(bp, [identity1, identity2])
		let completedQuests = await CompletedQuest.findAll()
		expect(completedQuests.length).toBe(3)
		expect(completedQuests[0].identityId).toBe(identity1.id)
		expect(completedQuests[0].questId).toBe(quest1.id)
		expect(completedQuests[0].guildId).toBe(''.padEnd(15, '4'))
		expect(completedQuests[1].identityId).toBe(identity1.id)
		expect(completedQuests[1].questId).toBe(quest1.id)
		expect(completedQuests[1].guildId).toBe(''.padEnd(15, '4'))
		expect(completedQuests[2].identityId).toBe(identity2.id)
		expect(completedQuests[2].questId).toBe(quest1.id)
		expect(completedQuests[2].guildId).toBe(''.padEnd(15, '4'))

		let progress = await QuestProgress.findAll()
		expect(progress.length).toBe(2)
		expect(progress[0].questId).toBe(quest1.id)
		expect(progress[0].identityId).toBe(identity1.id)
		expect(progress[0].progress).toBe(2)
		expect(progress[1].questId).toBe(quest1.id)
		expect(progress[1].identityId).toBe(identity2.id)
		expect(progress[1].progress).toBe(1)

		await processBattlepassQuests(bp, [identity1, identity2])
		let newCompletedQuestsCount = await CompletedQuest.count()
		expect(newCompletedQuestsCount).toBe(completedQuests.length)
	})
})
