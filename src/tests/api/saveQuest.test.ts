import { describe, expect, test, it, beforeEach, beforeAll } from '@jest/globals'
import request = require('supertest')

import truncate from '../truncate'
import { initDB, sequelize, Battlepass, Identity, QuestProgress, BattlepassParticipant } from '../../db'
import { app } from '../../api/server'

describe('Save new quest', () => {
	beforeAll(async () => {
		await initDB()
		await sequelize.sync({ force: true })
	})

	beforeEach(async () => {
		await truncate()
	})
	let chainId = '111111111111111111111111111111111111111111111111111111111111111111'
	let orgId = '222222222222222222222222222222222222222222222222222222222222222222'

	test('New non-repeatable quest', async () => {
		let battlepass = await Battlepass.create({
			chainId,
			orgId,
			startDate: new Date(),
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
		await BattlepassParticipant.bulkCreate([
			{
				battlepassId: battlepass.id,
				identityId: identity1.id,
			},
			{
				battlepassId: battlepass.id,
				identityId: identity2.id,
			},
		])

		const res = await request(app)
			.post('/api/quest')
			.send({
				battlepass: battlepass.chainId,
				daily: false,
				source: 'discord',
				type: 'post',
				quantity: 100,
				points: 5000,
			})
			.set('Accept', 'application/json')
			.expect(201)
			.then(async (response: any) => {
				expect(response.body.success).toBeTruthy()
				expect(response.body.quest.daily).toBeFalsy()
				expect(response.body.quest.source).toBe('discord')
				expect(response.body.quest.type).toBe('post')
				expect(response.body.quest.quantity).toBe(100)
				expect(response.body.quest.points).toBe(5000)
				expect(response.body.quest.battlepass).toBe(battlepass.chainId)

				let progress = await QuestProgress.findAll()
				expect(progress.length).toBe(2)
				expect(progress[0].identityId).toBe(identity1.id)
				expect(progress[1].identityId).toBe(identity2.id)
			})
	})

	test('New daily quest', async () => {
		let battlepass = await Battlepass.create({
			chainId: '111111111111111111111111111111111111111111111111111111111111111111',
			orgId: '222222222222222222222222222222222222222222222222222222222222222222',
			startDate: new Date(),
			active: true,
			finalized: false,
		})

		const res = await request(app)
			.post('/api/quest')
			.send({
				battlepass: battlepass.chainId,
				daily: true,
				maxDaily: 10,
				source: 'discord',
				type: 'post',
				quantity: 100,
				points: 5000,
			})
			.set('Accept', 'application/json')
			.expect(201)
			.then((response: any) => {
				expect(response.body.success).toBeTruthy()
				expect(response.body.quest.daily).toBeTruthy()
				expect(response.body.quest.maxDaily).toBe(10)
				expect(response.body.quest.source).toBe('discord')
				expect(response.body.quest.type).toBe('post')
				expect(response.body.quest.quantity).toBe(100)
				expect(response.body.quest.points).toBe(5000)
				expect(response.body.quest.battlepass).toBe(battlepass.chainId)
			})
	})
})
