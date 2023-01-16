import { describe, expect, test, it, beforeEach, beforeAll } from '@jest/globals'
import request = require('supertest')

import truncate from '../truncate'
import { initDB, sequelize, Identity, Battlepass, Quest, CompletedQuest } from '../../db'
import { app } from '../../api/server'

describe('Get earned points', () => {
	beforeAll(async () => {
		await initDB()
		await sequelize.sync({ force: true })
	})

	beforeEach(async () => {
		await truncate()
	})

	let prepare = async function () {
		// identities
		let identity1 = await Identity.create({
			discord: '111111111111111',
			address: '111111111111111111111111111111111111111111111111',
		})
		let identity2 = await Identity.create({
			discord: '222222222222222',
			address: '222222222222222222222222222222222222222222222222',
		})

		// battlepasses
		let bp1 = await Battlepass.create({
			chainId: '111111111111111111111111111111111111111111111111111111111111111111',
			orgId: '222222222222222222222222222222222222222222222222222222222222222222',
			startDate: new Date('2022-12-31T23:59:59Z'),
			active: true,
			finalized: false,
		})
		let bp2 = await Battlepass.create({
			chainId: '333333333333333333333333333333333333333333333333333333333333333333',
			orgId: '444444444444444444444444444444444444444444444444444444444444444444',
			startDate: new Date('2023-01-01T11:50:00Z'),
			active: true,
			finalized: false,
		})

		// battlepass quests
		let bp1q1 = await Quest.create({
			repeat: false,
			source: 'discord',
			type: 'post',
			channelId: null,
			quantity: 5,
			points: 1000,
			BattlepassId: bp1.id,
		})
		let bp1q2 = await Quest.create({
			repeat: true,
			source: 'discord',
			type: 'post',
			channelId: '111111111111111111',
			quantity: 10,
			points: 500,
			maxDaily: 5,
			BattlepassId: bp1.id,
		})
		let bp2q1 = await Quest.create({
			repeat: false,
			source: 'discord',
			type: 'post',
			channelId: null,
			quantity: 5,
			points: 1000,
			BattlepassId: bp2.id,
		})
		let bp2q2 = await Quest.create({
			repeat: true,
			source: 'discord',
			type: 'post',
			channelId: '111111111111111111',
			quantity: 10,
			points: 500,
			maxDaily: 5,
			BattlepassId: bp2.id,
		})

		// battlepass completed quests
		let bp1q1c1 = await CompletedQuest.create({
			createdAt: new Date('2023-01-01T00:01:00Z'),
			updatedAt: new Date('2023-01-01T00:01:00Z'),
			IdentityId: identity1.id,
			QuestId: bp1q1.id,
			guildId: '1',
		})
		let bp1q1c2 = await CompletedQuest.create({
			createdAt: new Date('2023-01-01T00:02:00Z'),
			updatedAt: new Date('2023-01-01T00:02:00Z'),
			IdentityId: identity2.id,
			QuestId: bp1q1.id,
			guildId: '1',
		})
		let bp1q2c1 = await CompletedQuest.create({
			createdAt: new Date('2023-01-01T00:03:00Z'),
			updatedAt: new Date('2023-01-01T00:03:00Z'),
			IdentityId: identity1.id,
			QuestId: bp1q2.id,
			guildId: '1',
		})
		let bp1q2c3 = await CompletedQuest.create({
			createdAt: new Date('2023-01-01T00:03:00Z'),
			updatedAt: new Date('2023-01-01T00:03:00Z'),
			IdentityId: identity1.id,
			QuestId: bp1q2.id,
			guildId: '1',
		})
		let bp1q2c4 = await CompletedQuest.create({
			createdAt: new Date('2023-01-01T00:03:00Z'),
			updatedAt: new Date('2023-01-01T00:03:00Z'),
			IdentityId: identity1.id,
			QuestId: bp1q2.id,
			guildId: '1',
		})
		let bp1q2c2 = await CompletedQuest.create({
			createdAt: new Date('2023-01-01T00:04:00Z'),
			updatedAt: new Date('2023-01-01T00:04:00Z'),
			IdentityId: identity2.id,
			QuestId: bp1q2.id,
			guildId: '1',
		})
		let bp2q1c1 = await CompletedQuest.create({
			createdAt: new Date('2023-01-01T00:05:00Z'),
			updatedAt: new Date('2023-01-01T00:05:00Z'),
			IdentityId: identity1.id,
			QuestId: bp2q1.id,
			guildId: '1',
		})
		let bp2q1c2 = await CompletedQuest.create({
			createdAt: new Date('2023-01-01T00:06:00Z'),
			updatedAt: new Date('2023-01-01T00:06:00Z'),
			IdentityId: identity2.id,
			QuestId: bp2q1.id,
			guildId: '1',
		})
		let bp2q2c1 = await CompletedQuest.create({
			createdAt: new Date('2023-01-01T00:07:00Z'),
			updatedAt: new Date('2023-01-01T00:07:00Z'),
			IdentityId: identity1.id,
			QuestId: bp2q2.id,
			guildId: '1',
		})
		let bp2q2c2 = await CompletedQuest.create({
			createdAt: new Date('2023-01-01T00:08:00Z'),
			updatedAt: new Date('2023-01-01T00:08:00Z'),
			IdentityId: identity2.id,
			QuestId: bp2q2.id,
			guildId: '1',
		})
	}

	test('All earned points for battlepass', async () => {
		await prepare()

		const res = await request(app)
			.get('/api/points')
			.query({
				battlepass: '111111111111111111111111111111111111111111111111111111111111111111',
			})
			.set('Accept', 'application/json')
			.expect(200)
			.then(async (response: any) => {
				expect(response.body.success).toBeTruthy()
				expect(response.body.points.length).toBe(2)

				expect(response.body.points[0].discord).toBe('111111111111111')
				expect(response.body.points[0].quests).toBe(4)
				expect(response.body.points[0].points).toBe(2500)

				expect(response.body.points[1].discord).toBe('222222222222222')
				expect(response.body.points[1].quests).toBe(2)
				expect(response.body.points[1].points).toBe(1500)
			})
	})

	test('Earned points, changed since last update', async () => {
		const res = await request(app)
			.get('/api/points')
			.query({
				battlepass: '111111111111111111111111111111111111111111111111111111111111111111',
				since: new Date('2023-01-01T00:03:10Z').toISOString(),
			})
			.set('Accept', 'application/json')
			.expect(200)
			.then(async (response: any) => {
				expect(response.body.success).toBeTruthy()
				// expect(response.body.points.length).toBe(1);
				// expect(response.body.points[0].discord).toBe('222222222222222');
				// expect(response.body.points[0].quests).toBe(2);
				// expect(response.body.points[0].points).toBe(1500);
			})
	})
})
