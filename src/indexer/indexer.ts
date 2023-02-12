import { Op } from 'sequelize'
import { request, gql } from 'graphql-request'
import { hexToString } from '@polkadot/util'

import { config } from '../config'
import { logger } from '../logger'
import { Battlepass, BattlepassParticipant, Identity, Quest, QuestProgress } from '../db'

function getBattlepassesQuery(fromBlock: number) {
	return gql`
	query Battlepasses {
		battlepass(where: {_or: {created_at_block: {_gt: ${fromBlock}}, updated_at_block: {_gt: ${fromBlock}}}}) {
			id
			name
			active_from_block
			active_to_block
			organization {
				id
			}
		}
	}
`
}

function getUsersQuery(battlePassId: string) {
	return gql`
	query Users {
		battlepass_nft(where: {battlepass: {id: {_eq: "${battlePassId}"}}}) {
			owner {
				address
			}
		}
	}
	`
}

function getTimeQuery() {
	return gql`
		query BlockTime {
			chain_state(limit: 1, order_by: { block_number: desc }) {
				block_number
				timestamp
			}
		}
	`
}

export async function getLastBlockTimestamp(): Promise<[number, Date] | null> {
	let resp: any
	try {
		resp = await request(config.graph.url, getTimeQuery())
	} catch (error) {
		logger.error('Failed to request events from graph %s', error)
		return null
	}
	for (let item of resp.chain_state) {
		let blockNumber = item.block_number
		let date = new Date(item.timestamp)
		return [blockNumber, date]
	}
	logger.error('Not found block info in graph')
	return null
}

export function calculateBlockDate(knownDate: Date, knownBlock: number, block: number) {
	let offsetSecs = (block - knownBlock) * config.chain.blockTime
	return new Date(knownDate.getTime() + 1000 * offsetSecs)
}

async function getBattlepasses(
	fromBlock: number,
	knownBlock: number,
	knownDate: Date,
): Promise<Map<string, any> | null> {
	let resp: any
	try {
		resp = await request(config.graph.url, getBattlepassesQuery(fromBlock))
	} catch (error) {
		logger.error('Failed to request battlepasses from graph %s', error)
		return null
	}
	let res = new Map<string, Object>()
	resp.battlepass.forEach((bp: any) => {
		let item = {
			chainId: bp.id,
			name: bp.name,
			orgId: bp.organization.id,
			startDate: calculateBlockDate(knownDate, knownBlock, bp.active_from_block),
			endDate: bp.active_to_block ? calculateBlockDate(knownDate, knownBlock, bp.active_to_block) : null,
		}
		res.set(bp.id, item)
	})
	logger.info('Fetched %d battlepasses from graph', res.size)
	return res
}

export async function getBattlepassUsers(battlePassId: string): Promise<string[] | null> {
	let resp: any
	try {
		resp = await request(config.graph.url, getUsersQuery(battlePassId))
	} catch (error) {
		logger.error('Failed to request battlepass users from graph %s', error)
		return null
	}
	let res = new Array<string>()
	resp.battlepass_nft.forEach((nft: any) => {
		res.push(nft.owner.address)
	})
	return res
}

async function processBattlepassParticipants(battlepass: Battlepass) {
	let chainUsers = await getBattlepassUsers(battlepass.chainId)
	if (chainUsers === null) {
		logger.warn('Failed to get users for the battlepass %s', battlepass.chainId)
		return
	}
	let identities = await Identity.findAll({
		where: {
			address: chainUsers,
		},
	})
	let identitiesMap = new Map<string, Identity>()
	identities.map((i) => {
		if (i.address !== null) identitiesMap.set(i.address, i)
	})
	let newUsers = []
	for (let chainUser of chainUsers) {
		if (!identitiesMap.has(chainUser)) {
			newUsers.push({ address: chainUser })
		}
	}
	if (newUsers) {
		;(await Identity.bulkCreate(newUsers)).map((i) => {
			if (i.address !== null) identitiesMap.set(i.address, i)
		})
	}
	let participants = await BattlepassParticipant.findAll({
		where: { battlepassId: battlepass.id },
		include: [
			{
				model: Identity,
				required: true,
				attributes: ['address'],
				where: {
					address: {
						[Op.ne]: null,
					},
				},
			},
		],
	})
	let participantsMap = new Map<string, BattlepassParticipant>()
	participants.map((i: any) => {
		participantsMap.set(i.identity.address, i)
	})
	let newParticipants: any = []
	for (let address of chainUsers) {
		if (!participantsMap.has(address)) {
			newParticipants.push({
				battlepassId: battlepass.id,
				identityId: identitiesMap.get(address)?.id,
			})
		}
	}
	if (newParticipants) {
		logger.debug('Saving %s new participants for battlepass %s', newParticipants.length, battlepass.chainId)
		await BattlepassParticipant.bulkCreate(newParticipants)

		let quests = await Quest.findAll({
			where: {
				battlepassId: battlepass.id,
			},
		})
		let newProgress: any = []
		quests.map((q) => {
			newParticipants.map((p: any) => {
				newProgress.push({
					questId: q.id,
					identityId: p.identityId,
					progress: 0,
				})
			})
		})
		if (newProgress) {
			logger.debug('Saving %s new progress records for battlepass %s', newProgress.length, battlepass.chainId)
			await QuestProgress.bulkCreate(newProgress)
		}
	}
}

export async function processBattlepasses(
	fromBlock: number,
	knownBlock: number,
	knownDate: Date,
	existingBattlepasses: Map<string, Battlepass>,
) {
	let updatedBattlepasses = await getBattlepasses(fromBlock, knownBlock, knownDate)
	if (updatedBattlepasses == null) {
		return
	}
	for (let [updatedId, updatedBp] of updatedBattlepasses) {
		let existingBp = existingBattlepasses.get(updatedId)
		if (existingBp == undefined) {
			let bp = await Battlepass.create({
				chainId: updatedId,
				orgId: updatedBp.orgId,
				startDate: updatedBp.startDate,
				endDate: updatedBp.endDate,
				active: updatedBp.endDate == null,
				finalized: false,
			})
			logger.debug('Found new battlepass %s', updatedId)
			await processBattlepassParticipants(bp)
		} else {
			existingBp.endDate = updatedBp.endDate
			existingBp.active = updatedBp.endDate == null
			await existingBp.save()
			await processBattlepassParticipants(existingBp)
			logger.debug('Updating info for %s battlepass', updatedId)
		}
	}
}
