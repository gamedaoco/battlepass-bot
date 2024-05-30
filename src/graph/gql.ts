import * as fs from 'fs'
import express from 'express'

import { GraphQLError } from 'graphql'
import { ApolloServer, gql } from 'apollo-server-express'
import { ApolloServerPlugin } from 'apollo-server-plugin-base'
import { ApolloServerPluginLandingPageLocalDefault } from 'apollo-server-core'

import { config } from '../config'
import { logger } from '../logger'
import {
	CreateIdentitySchema,
	PointUpdatesSchema,
	CreateQuestSchema,
	CreateRewardSchema,
	CreateLevelsSchema,
	AddParticipantSchema,
	SetBattlepassFreePassesSchema,
	PaymentSchema,
	ClaimRewardSchema,
	UpdateBattlepassSchema,
	UserTokenSchema,
} from './validations'
import {
	getPoints,
	getCompletedQuests,
	getQuests,
	saveIdentity,
	saveQuest,
	createReward,
	createLevels,
	addBattlepassParticipant,
	setFreePasses,
	processPayment,
	joinPremium,
	claimReward,
	updateBattlepass,
	provideUserToken,
} from './controllers'

import {
	battlepasses,
	battlepassQuests,
	battlepassMembers,
	battlepassRewards,
	formattedDate,
	formatPrice,
	currency,
} from './resolvers/battlepass'
import { quests, questBattlepass, questProgress } from './resolvers/quests'
import { members, memberBattlepass, memberIdentity, memberProgress, memberPoints } from './resolvers/members'
import { progress, progressQuest, progressIdentity, progressIdentityUuid } from './resolvers/progress'
import { identities, identityMembers, identityProgress } from './resolvers/identities'
import { points, pointIdentity, pointBattlepass } from './resolvers/points'
import { rewards, rewardBattlepass } from './resolvers/rewards'
import { levels, levelBattlepass } from './resolvers/levels'
import { rewardClaims, rewardClaimReward, rewardClaimMember } from './resolvers/rewardClaims'

const typeDefs = gql(fs.readFileSync(process.cwd() + '/src/schema.graphql').toString())

const resolvers = {
	Query: {
		Battlepasses: battlepasses,
		BattlepassQuests: quests,
		BattlepassMembers: members,
		BattlepassProgresses: progress,
		BattlepassIdentities: identities,
		BattlepassPoints: points,
		BattlepassRewards: rewards,
		BattlepassLevels: levels,
		BattlepassRewardClaims: rewardClaims,
	},
	Battlepass: {
		quests: battlepassQuests,
		members: battlepassMembers,
		rewards: battlepassRewards,
		startDate: formattedDate('startDate'),
		endDate: formattedDate('endDate'),
		price: formatPrice,
		currency,
	},
	BattlepassQuest: {
		battlepass: questBattlepass,
		progresses: questProgress,
	},
	BattlepassMember: {
		battlepass: memberBattlepass,
		identity: memberIdentity,
		progress: memberProgress,
		// points: memberPoints,
	},
	BattlepassQuestProgress: {
		quest: progressQuest,
		identity: progressIdentity,
	},
	BattlepassIdentity: {
		members: identityMembers,
		progress: identityProgress,
	},
	BattlepassPoint: {
		identity: pointIdentity,
		battlepass: pointBattlepass,
	},
	BattlepassReward: {
		battlepass: rewardBattlepass,
	},
	BattlepassRewardClaim: {
		reward: rewardClaimReward,
		member: rewardClaimMember,
	},
	BattlepassLevel: {
		battlepass: levelBattlepass,
	},
	Mutation: {
		identity: async (parent: any, args: any) => {
			let input = CreateIdentitySchema.validate(args)
			if (input.error) {
				logger.debug('Invalid identity request %s', input.error)
				throw new GraphQLError('Invalid input', {
					extensions: { code: 'BAD_USER_INPUT', description: input.error.toString() },
				})
			}
			let [identity, created] = await saveIdentity(input.value)
			return identity
		},
		quest: async (parent: any, args: any) => {
			let input = CreateQuestSchema.validate(args)
			if (input.error) {
				logger.debug('Invalid quest request %s', input.error)
				throw new GraphQLError('Invalid input', {
					extensions: { code: 'BAD_USER_INPUT', description: input.error.toString() },
				})
			}
			return await saveQuest(input.value)
		},
		join: async (parent: any, args: any) => {
			let input = AddParticipantSchema.validate(args)
			if (input.error) {
				logger.debug('Invalid join request %s', input.error)
				throw new GraphQLError('Invalid input', {
					extensions: { code: 'BAD_USER_INPUT', description: input.error.toString() },
				})
			}
			let res = await addBattlepassParticipant(input.value)
			return res
		},
		joinPremium: async (parent: any, args: any) => {
			let input = AddParticipantSchema.validate(args)
			if (input.error) {
				logger.debug('Invalid join request %s', input.error)
				throw new GraphQLError('Invalid input', {
					extensions: { code: 'BAD_USER_INPUT', description: input.error.toString() },
				})
			}
			let res = await joinPremium(input.value)
			return res
		},
		reward: async (parent: any, args: any) => {
			let input = CreateRewardSchema.validate(args)
			if (input.error) {
				logger.debug('Invalid reward request %s', input.error)
				throw new GraphQLError('Invalid input', {
					extensions: { code: 'BAD_USER_INPUT', description: input.error.toString() },
				})
			}
			return await createReward(input.value)
		},
		levels: async (parent: any, args: any) => {
			let input = CreateLevelsSchema.validate(args)
			if (input.error) {
				logger.debug('Invalid levels request %s', input.error)
				throw new GraphQLError('Invalid input', {
					extensions: { code: 'BAD_USER_INPUT', description: input.error.toString() },
				})
			}
			return await createLevels(input.value)
		},
		setFreePasses: async (parent: any, args: any) => {
			let input = SetBattlepassFreePassesSchema.validate(args)
			if (input.error) {
				logger.debug('Invalid freePasses request %s', input.error)
				throw new GraphQLError('Invalid input', {
					extensions: { code: 'BAD_USER_INPUT', description: input.error.toString() },
				})
			}
			return await setFreePasses(input.value)
		},
		processPayment: async (parent: any, args: any) => {
			let input = PaymentSchema.validate(args)
			if (input.error) {
				logger.debug('Invalid payment request %s', input.error)
				throw new GraphQLError('Invalid input', {
					extensions: { code: 'BAD_USER_INPUT', description: input.error.toString() },
				})
			}
			return await processPayment(input.value)
		},
		claimReward: async (parent: any, args: any) => {
			let input = ClaimRewardSchema.validate(args)
			if (input.error) {
				logger.debug('Invalid claim reward request %s', input.error)
				throw new GraphQLError('Invalid input', {
					extensions: { code: 'BAD_USER_INPUT', description: input.error.toString() },
				})
			}
			return await claimReward(input.value)
		},
		updateBattlepass: async (parent: any, args: any) => {
			let input = UpdateBattlepassSchema.validate(args)
			if (input.error) {
				logger.debug('Invalid update battlepass request %s', input.error)
				throw new GraphQLError('Invalid input', {
					extensions: { code: 'BAD_USER_INPUT', description: input.error.toString() },
				})
			}
			return await updateBattlepass(input.value)
		},
		provideUserToken: async (parent: any, args: any) => {
			let input = UserTokenSchema.validate(args)
			if (input.error) {
				logger.debug('Invalid user token request %s', input.error)
				throw new GraphQLError('Invalid input', {
					extensions: { code: 'BAD_USER_INPUT', description: input.error.toString() },
				})
			}
			return await provideUserToken(input.value)
		},
	},
}

function getServer(): ApolloServer {
	let plugins = new Array<ApolloServerPlugin>()
	if (config.graph.gqlUi) {
		plugins.push(
			ApolloServerPluginLandingPageLocalDefault({
				embed: true,
			}),
		)
	}
	const server = new ApolloServer({
		typeDefs,
		resolvers,
		introspection: true,
		plugins: plugins,
	})
	return server
}

export async function applyApolloServer(expressApp: express.Express) {
	const server = getServer()
	await server.start()
	server.applyMiddleware({ app: expressApp })
}
