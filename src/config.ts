import * as dotenv from 'dotenv';
dotenv.config()


export function validateConfigs(service: 'aggregation'| 'api' | 'chain' | 'discord') {
	let requiredEnvVariables = new Array<string>();
	switch (service) {
		case 'aggregation':
			requiredEnvVariables.push('GRAPH_URL')
			break
		case 'api':
			// no required variables
			break
		case 'chain':
			requiredEnvVariables.push(...['GRAPH_URL', 'CHAIN_RPC_URL'])
			break
		case 'discord':
			requiredEnvVariables.push('DISCORD_BOT_KEY')
			break
	}
	requiredEnvVariables.forEach((name) => {
		if (!process.env[name]) {
			throw new Error(`Required env variable not specified ${name}`)
		}
	})
}

export const config = {
	discord: {
		botKey: process.env.DISCORD_BOT_KEY,
	},
	logging: {
		level: process.env.LOGGING_LEVEL || 'debug',
		json: !!process.env.LOGGING_JSON,
	},
	db: {
		url: process.env.DATABASE_URL || 'sqlite::memory:',
	},
	graph: {
		url: process.env.GRAPH_URL || '',
	},
	chain: {
		blockTime: 12,
		rpcUrl: process.env.CHAIN_RPC_URL || '',
	},
	api: {
		port: parseInt(process.env.API_PORT || '8080'),
		secretKey: process.env.API_SECRET_KEY || '',
		gqlUi: !!process.env.API_GRAPHQL_UI
	},
	general: {
		checkFrequency: parseInt(process.env.QUEST_CHECK_FREQUENCY || '60'),
	},
}
