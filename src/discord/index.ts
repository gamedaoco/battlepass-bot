import { Client, Guild, IntentsBitField, Events } from 'discord.js';

import { config, validateConfigs } from '../config';
import { logger } from '../logger';
import { sequelize, initDB } from '../db';
import { onMessage, onMessageDeleted } from './live';
import { getHistoricalEvents } from './historical';

export function getClient() {
	let intents = new IntentsBitField([
		IntentsBitField.Flags.GuildMessages,
      	IntentsBitField.Flags.Guilds
	]);
	const client = new Client({ intents });
	return client;
}

async function main() {
	validateConfigs('discord');
	if (!await initDB()) {
		logger.error('Failed to connect to database.');
		return -1;
	}
	await sequelize.sync();

	let discordApi = getClient();

	discordApi.once(Events.ClientReady, async c => {
		logger.debug('Discord client ready');
		discordApi.guilds.cache.map(async (guild: Guild) => {
			const guildId = guild.id;
			logger.debug('Collecting historical events for %s guild', guildId);
			await getHistoricalEvents(discordApi, guildId);
		});
		discordApi.on('messageCreate', onMessage);
		discordApi.on('messageDelete', onMessageDeleted);
	});

	discordApi.login(config.discord.botKey);
}


main().catch(error => logger.error(error));
