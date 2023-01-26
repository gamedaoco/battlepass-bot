import * as fs from 'fs'
import express from 'express'

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
	addBattlepassParticipant,
} from './controllers'

import { battlepasses, battlepassQuests, battlepassMembers, battlepassRewards, formattedDate } from './resolvers/battlepass'
import { quests, questBattlepass, questProgress } from './resolvers/quests'
import { members, memberBattlepass, memberIdentity, memberProgress, memberPoints } from './resolvers/members'
import { progress, progressQuest, progressIdentity } from './resolvers/progress'
import { identities, identityMembers, identityProgress } from './resolvers/identities'
import { points, pointIdentity, pointBattlepass } from './resolvers/points'
import { rewards, rewardBattlepass } from './resolvers/rewards'

const typeDefs = gql(fs.readFileSync(process.cwd() + '/src/schema.graphql').toString())

const resolvers = {
	Query: {
		Battlepasses: battlepasses,
		BattlepassQuests: quests,
		BattlepassMembers: members,
		BattlepassProgresses: progress,
		BattlepassIdentities: identities,
		BattlepassPoints: points,
		BattlepassRewards: rewards
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
		battlepass: rewardBattlepass
	},
	Mutation: {
		identity: async (parent: any, args: any) => {
			let input = CreateIdentitySchema.validate(args)
			if (input.error) {
				logger.debug('Invalid identity request %s', input.error)
				return null
			}
			let [identity, created] = await saveIdentity(input.value.discord, input.value.twitter, input.value.address)
			return identity
		},
		quest: async (parent: any, args: any) => {
			let input = CreateQuestSchema.validate(args)
			if (input.error) {
				logger.debug('Invalid quest request %s', input.error)
				return null
			}
			return await saveQuest(
				input.value.battlepass,
				input.value.daily,
				input.value.source,
				input.value.type,
				input.value.channelId,
				input.value.quantity,
				input.value.points,
				input.value.maxDaily,
			)
		},
		participant: async (parent: any, args: any) => {
			let input = AddParticipantSchema.validate(args)
			if (input.error) {
				logger.debug('Invalid participant request %s', input.error)
				return null
			}
			let res = await addBattlepassParticipant(input.value.battlepass, input.value.discord, input.value.twitter)
			if (res !== null) {
				let [identity, created] = res
				return identity
			} else {
				return null
			}
		},
		reward: async (parent: any, args: any) => {
			let input = CreateRewardSchema.validate(args)
			if (input.error) {
				logger.debug('Invalid reward request %s', input.error)
				return null
			}
			return await createReward(
				input.value.battlepass,
				input.value.cid,
				input.value.name,
				input.value.points,
				input.value.level,
				input.value.total
			)
		}
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
