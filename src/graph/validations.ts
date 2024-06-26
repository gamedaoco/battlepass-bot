import * as Joi from 'joi'

export const CreateIdentitySchema = Joi.object({
	uuid: Joi.string().guid({ version: 'uuidv4' }).allow(null),
	discord: Joi.string().alphanum().min(10).max(20).allow(null),
	twitter: Joi.string().alphanum().min(10).max(20).allow(null),
	address: Joi.string().alphanum().length(48).allow(null),
	name: Joi.string().min(1).max(32).trim().allow(null),
	email: Joi.string().max(50).email().allow(null),
	cid: Joi.string().min(3).max(50).allow(null),
}).or('discord', 'twitter', 'address')

export const CreateQuestSchema = Joi.object({
	battlepass: Joi.string().required().length(66),
	name: Joi.string().min(5).max(100).allow(null),
	description: Joi.string().min(5).max(512).allow(null),
	link: Joi.string().uri().min(10).max(150).allow(null),
	cid: Joi.string().min(5).max(100).allow(null),
	daily: Joi.boolean().default(false),
	source: Joi.string().required().valid('discord', 'twitter', 'gamedao', 'epicGames'),
	type: Joi.string()
		.required()
		.when('source', {
			switch: [
				{ is: 'discord', then: Joi.valid('connect', 'join', 'post', 'reaction') },
				{ is: 'twitter', then: Joi.valid('connect', 'tweet', 'retweet', 'follow', 'comment', 'like') },
				{ is: 'gamedao', then: Joi.valid('connect', 'identity') },
				{ is: 'epicGames', then: Joi.valid('connect') },
			],
		}),
	guildId: Joi.when('type', {
		is: Joi.valid('join', 'post'),
		then: Joi.string().min(10).max(50).required(),
	}),
	channelId: Joi.when('type', {
		is: 'post',
		then: Joi.string().min(10).max(50),
	}),
	hashtag: Joi.when('type', {
		is: 'tweet',
		then: Joi.string().min(3).max(100).required(),
	}),
	twitterId: Joi.when('type', {
		is: Joi.valid('retweet', 'follow', 'comment', 'like'),
		then: Joi.string().min(3).max(100).regex(/^[_a-zA-Z0-9]+$/).required(),
	}),
	quantity: Joi.when('type', {
		is: Joi.valid('connect', 'join', 'follow'),
		then: Joi.number().integer().valid(1).default(1),
		otherwise: Joi.number().integer().required(),
	}),
	points: Joi.number().integer().required(),
	max: Joi.number().integer().allow(null),
	maxDaily: Joi.when('daily', {
		is: true,
		then: Joi.number().integer().required(),
	}),
})

export const CreateRewardSchema = Joi.object({
	battlepass: Joi.string().required().length(66),
	name: Joi.string().min(5).max(100).allow(null),
	description: Joi.string().min(5).max(512).allow(null),
	cid: Joi.string().min(5).max(50).allow(null),
	points: Joi.number().integer().allow(null),
	level: Joi.number().integer().allow(null),
	total: Joi.number().integer().min(1).max(1000000).required(),
}).or('level', 'points')

let Level = Joi.object({
	level: Joi.number().integer().min(1),
	points: Joi.number().integer().min(1),
	name: Joi.string().max(20).allow(null),
})

export const CreateLevelsSchema = Joi.object({
	battlepass: Joi.string().required().length(66),
	levels: Joi.array().items(Level),
})

export const PointUpdatesSchema = Joi.object({
	battlepass: Joi.string().required().length(66),
	since: Joi.date().iso(),
	address: Joi.string().alphanum().length(48),
})

export const AddParticipantSchema = Joi.object({
	battlepass: Joi.string().required().length(66),
	identityUuid: Joi.string().required().guid({ version: 'uuidv4' }),
})

export const SetBattlepassFreePassesSchema = Joi.object({
	battlepass: Joi.string().required().length(66),
	freePasses: Joi.number().integer().min(0).max(10000).required()
})

export const PaymentSchema = Joi.object({
	securityToken: Joi.string().required().min(1).max(100),
	battlepass: Joi.string().required().length(66),
	identityUuid: Joi.string().required().guid({ version: 'uuidv4' }),
	paymentToken: Joi.string().required().min(1).max(120)
})

export const ClaimRewardSchema = Joi.object({
	battlepass: Joi.string().required().length(66),
	identityUuid: Joi.string().required().guid({ version: 'uuidv4' }),
	reward: Joi.string().required().length(66),
})

export const UpdateBattlepassSchema = Joi.object({
	battlepass: Joi.string().required().length(66),
	freePasses: Joi.number().integer().min(0).max(10000),
	premiumPasses: Joi.number().integer().min(0).max(10000),
	joinable: Joi.boolean(),
})

export const UserTokenSchema = Joi.object({
	identityUuid: Joi.string().required().guid({ version: 'uuidv4' }),
	source: Joi.string().required().valid('twitter', 'epicGames'),
	token: Joi.string().required().min(1).max(500)
})
