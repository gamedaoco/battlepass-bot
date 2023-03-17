import { Op } from 'sequelize'
import { Job } from 'bullmq'
import { ApiPromise } from '@polkadot/api'
import { logger } from '../logger'
import { Battlepass, BattlepassLevel, BattlepassReward, BattlepassParticipant, CompletedQuest, Identity, RewardClaim, Quest, Payment, sequelize } from '../db'
import { getSigningAccount, isEventError, getEventError, getClient, executeTxWithResult } from './utils'

export async function worker(job: Job) {
	let type = job.data.type
	let client = await getClient()
	logger.debug('Received %s task', type)
	if (type == 'level') {
		await storeLevelOnChain(client, job.data.levelId)
	} else if (type == 'reward') {
		await storeRewardOnChain(client, job.data.rewardId)
	} else if (type == 'points') {
		await storeUserPointsOnChain(client, job.data.identityId, job.data.battlepassId)
	} else if (type == 'claimReward') {
		await claimUserReward(client, job.data.rewardClaimId)
	} else if (type == 'claimBattlepass') {
		await claimBattlepassAccess(client, job.data.participantId)
	} else {
		logger.error('Received task of uknown type %s', job.data)
	}
}

async function storeLevelOnChain(api: ApiPromise, levelId: number) {
	let level: any = await BattlepassLevel.findOne({
		where: { id: levelId },
		include: [{
			model: Battlepass,
			required: true,
			attributes: ['chainId']
		}]
	})
	let tx = api.tx.battlepass.addLevel(level.Battlepass.chainId, level.level, level.totalPoints)
	await executeTxWithResult(api, tx, api.events.battlepass.LevelAdded).then(async (event) => {
		logger.info(
			"Level %s %s for bp %s stored on chain",
			level.level, level.name, level.Battlepass.chainId
		)
		level.syncStatus = 'synced'
		await level.save()
	}).catch(async (err) => {
		logger.error(
			'Failed to store level on chain %s, level %s',
			err, levelId
		)
		logger.error(err)
		level.syncStatus = 'failed'
		await level.save()
	})
}

async function storeRewardOnChain(api: ApiPromise, rewardId: number) {
	let reward: any = await BattlepassReward.findOne({
		where: { id: rewardId },
		include: [{
			model: Battlepass,
			required: true,
			attributes: ['chainId']
		}]
	})
	if (!reward) {
		logger.error('Reward with id %s not found', rewardId)
		return
	}
	let tx = api.tx.battlepass.createReward(
		reward.Battlepass.chainId,
		reward.name, reward.cid,
		reward.total, reward.level,
		true
	)
	await executeTxWithResult(api, tx, api.events.battlepass.RewardCreated).then(async (event) => {
		let [rewardId, battlepassChainId, level] = event.data
		reward.chainId = rewardId.toString()
		reward.syncStatus = 'synced'
		await reward.save()
		logger.info("Reward %s created on chain", reward.chainId)
	}).catch(async (err) => {
		logger.error(
			'Failed to store reward on chain %s, reward id %s',
			err, rewardId
		)
		reward.syncStatus = 'failed'
		await reward.save()
	})
}

async function storeUserPointsOnChain(api: ApiPromise, identityId: number, battlepassId: number) {
	let bp: any = await BattlepassParticipant.findOne({
		include: [{
			model: Identity,
			required: true,
			where: { id: identityId, address: { [Op.ne]: null } },
			attributes: ['address']
		}, {
			model: Battlepass,
			required: true,
			where: { id: battlepassId },
			attributes: ['chainId']
		}]
	})
	if (!bp || !bp.points) {
		logger.error(
			'Attempt to store user %s %s points on chain without any records',
			identityId, battlepassId
		)
		return
	}
	if (bp.status != 'synced' && bp.status != 'pending') {
		logger.error(
			'Attempt to store user %s %s points on chain without premium access',
			identityId, battlepassId
		)
		return
	}
	let account = getSigningAccount()
	let tx = api.tx.battlepass.setPoints(bp.Battlepass.chainId, bp.Identity.address, bp.points)
	await executeTxWithResult(api, tx, api.events.battlepass.PointsUpdated).then((event) => {
		logger.info(
			"Points updated on chain for account %s and battlepass %s",
			bp.Identity.address, bp.Battlepass.chainId
		)
	}).catch((err) => {
		logger.error(
			'Failed to store user points on chain %s, user %s bp %s',
			err, identityId, battlepassId
		)
	})
}

async function claimBattlepassAccess(api: ApiPromise, participantId: number) {
	let p: any = await BattlepassParticipant.findOne({
		where: { id: participantId },
		include: [{
			model: Battlepass,
			required: true,
			attributes: ['chainId']
		}, {
			model: Identity,
			required: true,
			attributes: ['address'],
			where: {
				address: { [Op.ne]: null }
			}
		}, {
			model: Payment,
			required: false
		}]
	})
	if (!p || !p.Identity) {
		logger.error('Not found identity to join battlepass for participant %s', participantId)
		return
	}
	if (p.premium) {
		logger.debug('Attempt to claim multiple battlepass access for same member %s', participantId)
		return
	}
	if (p.Battlepass.freeClaimed >= p.Battlepass.freePasses) {
		if (!p.Payment) {
			logger.warn('Attempt to claim battlepass without payment and no free passes left')
			p.status = 'free'
			await p.save()
			return
		}
	}
	p.status = 'pending'
	await p.save()
	let tx = api.tx.battlepass.claimBattlepass(p.Battlepass.chainId, p.Identity.address, null)
	await executeTxWithResult(api, tx, api.events.battlepass.BattlepassClaimed).then((event) => {
		logger.info('Participant %s successfully claimed battlepass access', participantId)
	}).catch((err) => {
		logger.error('Failed to claim battlepass access for participant %s', participantId)
		logger.error(err)
	})
}

async function claimUserReward(api: ApiPromise, rewardClaimId: number) {
	let claim: any = await RewardClaim.findOne({
		where: { id: rewardClaimId },
		include: [
			{
				model: BattlepassParticipant,
				required: true,
				include: [{
					model: Identity,
					required: true
				}]
			}, {
				model: BattlepassReward,
				required: true,
			}
		]
	})
	if (!claim) {
		logger.error('Claim attempt for unknown reward %s', rewardClaimId)
		return
	}
	if (claim.syncStatus != 'pending') {
		logger.warn(
			'Attempt to claim reward %s multiple times, status %s',
			rewardClaimId, claim.syncStatus
		)
		return
	}
	let user = claim.BattlepassParticipant?.Identity
	let reward = claim.BattlepassReward
	if (!user || !reward || reward.syncStatus != 'synced') {
		logger.error('Failed to claim reward for unknown user or reward')
		return
	}
	let tx = api.tx.battlepass.claimReward(reward.chainId, user.address, null)
	await executeTxWithResult(api, tx, api.events.battlepass.RewardClaimed).then(async (event) => {
		await BattlepassReward.increment({ available: -1 }, { where: { id: claim.BattlepassReward.id } })
		let [rewardChainId, claimer, collectionId, nftId] = event.data
		claim.syncStatus = 'synced'
		claim.nftId = parseInt(nftId.toString())
		await claim.save()
		logger.info(
			"Reward %s claimed for address %s",
			reward?.chainId, user?.address
		)
	}).catch(async (err) => {
		claim.syncStatus = 'failed'
		await claim.save()
		logger.error(
			'Failed to claim user reward due to erorr %s, claim id %s',
			err, rewardClaimId
		)
	})
}
