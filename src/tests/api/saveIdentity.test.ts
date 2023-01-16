import { describe, expect, test, it, beforeEach, beforeAll } from '@jest/globals'
import request = require('supertest')

import truncate from '../truncate'
import { initDB, sequelize, Identity } from '../../db'
import { app } from '../../api/server'

describe('Save new identity', () => {
	beforeAll(async () => {
		await initDB()
		await sequelize.sync({ force: true })
	})

	beforeEach(async () => {
		await truncate()
	})

	let validDiscord = '111111111111111111'

	test('New identity with discord field', async () => {
		const res = await request(app)
			.post('/api/identity')
			.send({ discord: validDiscord })
			.set('Accept', 'application/json')
			.expect(201)
			.then((response: any) => {
				expect(response.body.success).toBeTruthy()
				expect(response.body.identity.id).toBe(1)
				expect(response.body.identity.discord).toBe(validDiscord)
				expect(response.body.identity.twitter).toBeUndefined()
				expect(response.body.identity.address).toBeUndefined()
			})
	})

	test('Update identity with existing discord', async () => {
		let existing = await Identity.create({ discord: validDiscord })

		const res = await request(app)
			.post('/api/identity')
			.send({ discord: validDiscord })
			.set('Accept', 'application/json')
			.expect(200)
			.then((response: any) => {
				expect(response.body.success).toBeTruthy()
				expect(response.body.identity.id).toBe(existing.id)
				expect(response.body.identity.discord).toBe(validDiscord)
				expect(response.body.identity.twitter).toBeUndefined()
				expect(response.body.identity.address).toBeUndefined()
			})
	})

	test('Update identity with existing discord and address', async () => {
		let existing = await Identity.create({ discord: validDiscord })
		let address = '222222222222222222222222222222222222222222222222'

		const res = await request(app)
			.post('/api/identity')
			.send({ discord: validDiscord, address: address })
			.set('Accept', 'application/json')
			.expect(200)
			.then((response: any) => {
				expect(response.body.success).toBeTruthy()
				expect(response.body.identity.id).toBe(existing.id)
				expect(response.body.identity.discord).toBe(validDiscord)
				expect(response.body.identity.address).toBe(address)
				expect(response.body.identity.twitter).toBeUndefined()
			})
	})

	describe('Invalid requests', () => {
		test('No fields provided', async () => {
			const res = await request(app)
				.post('/api/identity')
				.send({})
				.set('Accept', 'application/json')
				.expect(400)
				.then((response: any) => {
					expect(response.body.success).toBeFalsy()
					expect(response.body.error).not.toBeNull()
					expect(response.body.error).toBeDefined()
				})
		})
	})
})
