import * as dotenv from 'dotenv'
dotenv.config()

export function validateConfigs(service: 'aggregation' | 'api' | 'chain' | 'discord' | 'twitter') {
	let requiredEnvVariables = new Array<string>()
	switch (service) {
		case 'aggregation':
			break
		case 'api':
			// no required variables
			requiredEnvVariables.push('API_SECURITY_TOKEN')
			break
		case 'chain':
			requiredEnvVariables.push(...['GRAPH_URL', 'CHAIN_RPC_URL', 'CHAIN_ACCOUNT'])
			break
		case 'discord':
			requiredEnvVariables.push('DISCORD_BOT_KEY')
			break
		case 'twitter':
			requiredEnvVariables.push(...['TWITTER_BEARER_TOKEN', 'TWITTER_CLIENT_ID', 'TWITTER_CLIENT_SECRET', 'TWITTER_REDIRECT_URI'])
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
		fetchMessagesSince: parseInt(process.env.DISCORD_FETCH_MESSAGES_SINCE || '2'),
	},
	twitter: {
		bearerToken: process.env.TWITTER_BEARER_TOKEN || '',
		clientId: process.env.TWITTER_CLIENT_ID || '',
		clientSecret: process.env.TWITTER_CLIENT_SECRET || '',
		redirectUri: process.env.TWITTER_REDIRECT_URI || '',
		checkFrequency: parseInt(process.env.TWITTER_UPDATES_CHECK_FREQUENCY || '960'),
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
		prefix: 25,
		rpcUrl: process.env.CHAIN_RPC_URL || '',
		account: process.env.CHAIN_ACCOUNT || ''
	},
	api: {
		port: parseInt(process.env.API_PORT || '8080'),
		secretKey: process.env.API_SECRET_KEY || '',
		securityToken: process.env.API_SECURITY_TOKEN || '',
		gqlUi: !!process.env.API_GRAPHQL_UI,
	},
	general: {
		checkFrequency: parseInt(process.env.QUEST_CHECK_FREQUENCY || '60'),
		redis: {
			host: process.env.REDIS_HOST || 'redis',
			port: parseInt(process.env.REDIS_PORT || '6379'),
			db: 0
			// todo: check connection is live when starting the service
		}
	},
}
