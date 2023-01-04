// [
// 	'DISCORD_BOT_KEY',
// 	'GRAPH_URL',
// 	'CHAIN_RPC_URL'
// ].forEach((name) => {
// 	if (!process.env[name]) {
// 		throw new Error(`Required env variable not specified ${name}`);
// 	}
// })

// todo: validate configs based on started service (api does not need discord key etc)

export const config = {
	discord: {
		botKey: process.env.DISCORD_BOT_KEY,
		guildIds: []
	},
	logging: {
		level: process.env.LOGGING_LEVEL || 'debug',
		json: !!process.env.LOGGING_JSON
	},
	db: {
		url: process.env.DATABASE_URL || 'sqlite::memory:'
	},
	graph: {
		url: process.env.GRAPH_URL || ''
	},
	chain: {
		blockTime: 12,
		rpcUrl: process.env.CHAIN_RPC_URL || ''
	},
	api: {
		port: parseInt(process.env.API_PORT || '8080')
	},
	general: {
		checkFrequency: parseInt(process.env.QUEST_CHECK_FREQUENCY || '60')
	}
}
