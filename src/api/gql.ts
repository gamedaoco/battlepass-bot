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
	AddParticipantSchema,
	QuestsSchema,
} from './validations'
import {
	getPoints,
	getCompletedQuests,
	getQuests,
	saveIdentity,
	saveQuest,
	addBattlepassParticipant,
} from './controllers'

import { battlepasses, battlepassQuests, battlepassMembers } from './resolvers/battlepass'
import { quests, questBattlepass, questProgress } from './resolvers/quests'
import { members, memberBattlepass, memberIdentity, memberProgress } from './resolvers/members'
import { progress, progressQuest, progressIdentity } from './resolvers/progress'
import { identities, identityMembers, identityProgress } from './resolvers/identities'
import { points, pointIdentity, pointBattlepass } from './resolvers/points'

const typeDefs = gql(fs.readFileSync(process.cwd() + '/src/schema.graphql').toString())

const resolvers = {
	Query: {
		Battlepasses: battlepasses,
		BattlepassQuests: quests,
		BattlepassMembers: members,
		BattlepassProgresses: progress,
		BattlepassIdentities: identities,
		BattlepassPoints: points,
	},
	Battlepass: {
		quests: battlepassQuests,
		members: battlepassMembers,
	},
	BattlepassQuest: {
		battlepass: questBattlepass,
		progresses: questProgress,
	},
	BattlepassMember: {
		battlepass: memberBattlepass,
		identity: memberIdentity,
		progress: memberProgress,
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
	// Query: {
	// 	points: async (parent: any, args: any) => {
	// 		let input = PointUpdatesSchema.validate(args)
	// 		if (input.error) {
	// 			logger.debug('Invalid points request %s', input.error)
	// 			return null
	// 		}
	// 		return await getPoints(input.value.battlepass, input.value.since, input.value.address)
	// 	},
	// 	completedQuests: async (parent: any, args: any) => {
	// 		let input = QuestUpdatesSchema.validate(args)
	// 		if (input.error) {
	// 			logger.debug('Invalid completed quests request %s', input.error)
	// 			return null
	// 		}
	// 		return await getCompletedQuests(input.value.battlepass, input.value.since, input.value.address)
	// 	},
	// 	quests: async (parent: any, args: any) => {
	// 		let input = QuestsSchema.validate(args)
	// 		if (input.error) {
	// 			logger.debug('Invalid quests request %s', input.error)
	// 			return null
	// 		}
	// 		return await getQuests(input.value.battlepass)
	// 	},
	// },
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
