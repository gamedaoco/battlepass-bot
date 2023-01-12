import * as fs from 'fs'
import express from 'express';
import { ApolloServer, gql } from 'apollo-server-express';

import { logger } from '../logger';
import { IdentitySchema, PointUpdatesSchema, QuestUpdatesSchema, QuestSchema } from './validations';
import { getPoints, getCompletedQuests, saveIdentity, saveQuest } from './controllers';


const typeDefs = gql(fs.readFileSync(process.cwd() + '/src/schema.graphql').toString());

const resolvers = {
	Query: {
		points: async (parent: any, args: any) => {
			let input = PointUpdatesSchema.validate(args);
			if (input.error) {
				logger.debug('Invalid points request %s', input.error);
				return null;
			}
			return await getPoints(input.value.battlepass, input.value.since, input.value.address);
		},
		completedQuests: async (parent: any, args: any) => {
			let input = QuestUpdatesSchema.validate(args);
			if (input.error) {
				logger.debug('Invalid completed quests request %s', input.error);
				return null;
			}
			return await getCompletedQuests(input.value.battlepass, input.value.since, input.value.address);
		}
	},
	Mutation: {
		identity: async (parent: any, args: any) => {
			let input = IdentitySchema.validate(args);
			if (input.error) {
				logger.debug('Invalid identity request %s', input.error);
				return null;
			}
			let [identity, created] = await saveIdentity(input.value.discord, input.value.twitter, input.value.address);
			return identity;
		},
		quest: async (parent: any, args: any) => {
			let input = QuestSchema.validate(args);
			if (input.error) {
				logger.debug('Invalid quest request %s', input.error);
				return null;
			}
			let quest = await saveQuest(
				input.value.battlepass, input.value.daily,
				input.value.source, input.value.type,
				input.value.channelId, input.value.quantity,
				input.value.points, input.value.maxDaily
			);
			if (!quest) {
				return null;
			} else {
				return {
					battlepass: input.value.battlepass,
					daily: quest.repeat,
					source: quest.source,
					type: quest.type,
					channelId: quest.channelId,
					quantity: quest.quantity,
					points: quest.points,
					maxDaily: quest.maxDaily
				};
			}
		}
	}
};

const server = new ApolloServer({ typeDefs, resolvers });

export async function applyApolloServer(expressApp: express.Express) {
	await server.start();
	server.applyMiddleware({app: expressApp});
}
