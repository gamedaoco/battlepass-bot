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
	QuestUpdatesSchema,
	CreateQuestSchema,
	CreateRewardSchema,
	CreateLevelsSchema,
	AddParticipantSchema,
	QuestsSchema,
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
} from './controllers'

import {
	battlepasses,
	battlepassQuests,
	battlepassMembers,
	battlepassRewards,
	formattedDate,
} from './resolvers/battlepass'
import { quests, questBattlepass, questProgress } from './resolvers/quests'
import { members, memberBattlepass, memberIdentity, memberProgress, memberPoints } from './resolvers/members'
import { progress, progressQuest, progressIdentity, progressIdentityUuid } from './resolvers/progress'
import { identities, identityMembers, identityProgress } from './resolvers/identities'
import { points, pointIdentity, pointBattlepass } from './resolvers/points'
import { rewards, rewardBattlepass } from './resolvers/rewards'
import { levels, levelBattlepass } from './resolvers/levels'

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
	},
	Battlepass: {
		quests: battlepassQuests,
		members: battlepassMembers,
		rewards: battlepassRewards,
		startDate: formattedDate('startDate'),
		endDate: formattedDate('endDate'),
	},
	BattlepassQuest: {
		battlepass: questBattlepass,
		progresses: questProgress,
	},
	BattlepassMember: {
		battlepass: memberBattlepass,
		identity: memberIdentity,
		progress: memberProgress,
		points: memberPoints,
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
			let [identity, created] = await saveIdentity(
				input.value.uuid,
				input.value.discord,
				input.value.twitter,
				input.value.address,
			)
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
			return await saveQuest(
				input.value.battlepass,
				input.value.daily,
				input.value.name,
				input.value.source,
				input.value.type,
				input.value.channelId,
				input.value.hashtag,
				input.value.twitterId,
				input.value.quantity,
				input.value.points,
				input.value.maxDaily,
			)
		},
		join: async (parent: any, args: any) => {
			let input = AddParticipantSchema.validate(args)
			if (input.error) {
				logger.debug('Invalid join request %s', input.error)
				throw new GraphQLError('Invalid input', {
					extensions: { code: 'BAD_USER_INPUT', description: input.error.toString() },
				})
			}
			let res = await addBattlepassParticipant(input.value.battlepass, input.value.identityUuid)
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
			return await createReward(
				input.value.battlepass,
				input.value.cid,
				input.value.name,
				input.value.description,
				input.value.points,
				input.value.level,
				input.value.total,
			)
		},
		levels: async (parent: any, args: any) => {
			let input = CreateLevelsSchema.validate(args)
			if (input.error) {
				logger.debug('Invalid levels request %s', input.error)
				throw new GraphQLError('Invalid input', {
					extensions: { code: 'BAD_USER_INPUT', description: input.error.toString() },
				})
			}
			return await createLevels(input.value.battlepass, input.value.levels)
		},
	},
}

function getServer(): ApolloServer {
	let plugins = new Array<ApolloServerPlugin>()
	if (config.api.gqlUi) {
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
