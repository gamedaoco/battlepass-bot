import { describe, expect, test, it, beforeEach, beforeAll } from '@jest/globals'
import request = require('supertest')

import truncate from '../truncate'
import { initDB, sequelize, Identity, Battlepass, DiscordActivity } from '../../db'
import { app } from '../../api/server'


describe('Save new identity', () => {
	beforeAll(async () => {
		await initDB()
		await sequelize.sync({ force: true })
	})

	beforeEach(async () => {
		await truncate()
	})

	async function getBattlepass(): Promise<Battlepass> {
		return await Battlepass.create({
			chainId: '111111111111111111111111111111111111111111111111111111111111111111',
			orgId: '222222222222222222222222222222222222222222222222222222222222222222',
			active: true,
			finalized: false,
		})
	}

	test('New identity with discord', async () => {
		let bp = await getBattlepass()
		const res = await request(app)
			.post('/api/participant')
			.send({
				battlepass: bp.chainId,
				discord: '333333333333',
			})
			.set('Accept', 'application/json')
			.expect(201)
			.then(async (response: any) => {
				expect(response.body.success).toBeTruthy()
				expect(response.body.identity.discord).toBe('333333333333')
				expect(response.body.identity.twitter).toBeUndefined()

				let activities = await DiscordActivity.findAll();
				expect(activities.length).toBe(1);
				expect(activities[0].activityType).toBe('connect');
				expect(activities[0].IdentityId).toBe(response.body.identity.id);
			})
	})

	test('New identity with twitter', async () => {
		let bp = await getBattlepass()
		const res = await request(app)
			.post('/api/participant')
			.send({
				battlepass: bp.chainId,
				twitter: '444444444444',
			})
			.set('Accept', 'application/json')
			.expect(201)
			.then((response: any) => {
				expect(response.body.success).toBeTruthy()
				expect(response.body.identity.twitter).toBe('444444444444')
				expect(response.body.identity.discord).toBeUndefined()
			})
	})

	test('New identity with discord and twitter', async () => {
		let bp = await getBattlepass()
		const res = await request(app)
			.post('/api/participant')
			.send({
				battlepass: bp.chainId,
				discord: '333333333333',
				twitter: '444444444444',
			})
			.set('Accept', 'application/json')
			.expect(201)
			.then((response: any) => {
				expect(response.body.success).toBeTruthy()
				expect(response.body.identity.discord).toBe('333333333333')
				expect(response.body.identity.twitter).toBe('444444444444')
			})
	})

	test('Existing user with discord', async () => {
		let bp = await getBattlepass()
		let user = await Identity.create({
			twitter: '444444444444',
		})
		const res = await request(app)
			.post('/api/participant')
			.send({
				battlepass: bp.chainId,
				discord: '333333333333',
				twitter: '444444444444',
			})
			.set('Accept', 'application/json')
			.expect(200)
			.then((response: any) => {
				expect(response.body.success).toBeTruthy()
				expect(response.body.identity.discord).toBe('333333333333')
				expect(response.body.identity.twitter).toBe('444444444444')
			})
	})

	test('Existing user with twitter', async () => {
		let bp = await getBattlepass()
		let user = await Identity.create({
			discord: '333333333333',
		})
		const res = await request(app)
			.post('/api/participant')
			.send({
				battlepass: bp.chainId,
				discord: '333333333333',
				twitter: '444444444444',
			})
			.set('Accept', 'application/json')
			.expect(200)
			.then((response: any) => {
				expect(response.body.success).toBeTruthy()
				expect(response.body.identity.discord).toBe('333333333333')
				expect(response.body.identity.twitter).toBe('444444444444')
			})
	})

	test('Invalid discord', async () => {
		let bp = await getBattlepass()
		const res = await request(app)
			.post('/api/participant')
			.send({
				battlepass: bp.chainId,
				discord: '3',
				twitter: '444444444444',
			})
			.set('Accept', 'application/json')
			.expect(400)
			.then((response: any) => {
				expect(response.body.success).toBeFalsy()
			})
	})

	test('Invalid twitter', async () => {
		let bp = await getBattlepass()
		const res = await request(app)
			.post('/api/participant')
			.send({
				battlepass: bp.chainId,
				discord: '333333333333',
				twitter: '4',
			})
			.set('Accept', 'application/json')
			.expect(400)
			.then((response: any) => {
				expect(response.body.success).toBeFalsy()
			})
	})

	test('Non existing battlepass', async () => {
		const res = await request(app)
			.post('/api/participant')
			.send({
				battlepass: '111111111111111111111111111111111111111111111111111111111111111111',
				discord: '333333333333',
				twitter: '444444444444',
			})
			.set('Accept', 'application/json')
			.expect(400)
			.then((response: any) => {
				expect(response.body.success).toBeFalsy()
			})
	})
})
