import { Client, Guild, IntentsBitField, Events } from 'discord.js'

import { config, validateConfigs } from '../config'
import { logger } from '../logger'
import { sequelize, initDB } from '../db'
import { onMessage, onMessageDeleted, onMemberJoin } from './live'
import { getHistoricalEvents, syncGuildMembers } from './historical'

export function getClient() {
	let intents = new IntentsBitField([IntentsBitField.Flags.GuildMessages, IntentsBitField.Flags.Guilds, IntentsBitField.Flags.GuildMembers])
	const client = new Client({ intents })
	return client
}

async function main() {
	validateConfigs('discord')
	if (!(await initDB())) {
		logger.error('Failed to connect to database.')
		return -1
	}
	await sequelize.sync()

	let discordApi = getClient()

	discordApi.once(Events.ClientReady, async (c) => {
		logger.debug('Discord client ready')
		discordApi.guilds.cache.map(async (guild: Guild) => {
			logger.debug('Collecting historical events for %s guild', guild.id)
			await syncGuildMembers(guild)
			await getHistoricalEvents(guild)
		})
		discordApi.on('messageCreate', onMessage)
		discordApi.on('messageDelete', onMessageDeleted)
		discordApi.on('guildMemberAdd', onMemberJoin)
	})

	discordApi.login(config.discord.botKey)
}

main().catch((error) => logger.error(error))
