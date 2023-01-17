import {
	Client,
	Guild,
	Channel,
	ChannelType,
	TextChannel,
	Events,
	GatewayIntentBits,
	Message,
	User,
	IntentsBitField,
	FetchMessagesOptions,
} from 'discord.js'

import { config } from '../config'
import { logger } from '../logger'
import { DiscordActivity, Identity } from '../db'
import { ActivityRecord } from './interfaces'


export async function getHistoricalEvents(client: Client, guildId: string) {
	let guild: Guild | undefined = client.guilds.cache.find((item: Guild) => item.id == guildId)
	if (guild === undefined) {
		logger.error('Discord guild with given ID not found.')
		return
	}
	await guild.channels.fetch().then(async (channels) => {
		channels.forEach(async (channel) => {
			if (channel instanceof TextChannel && channel.type == ChannelType.GuildText) {
				await syncChannelMessages(channel);
			} else {
				logger.debug('Skip channel %s syncing', (channel || 'null').toString())
			}
		})
	})
}

async function syncChannelMessages(channel: TextChannel) {
	if (channel === null) {
		logger.debug('Sync channel is empty')
		return
	}
	// if (channel.type !== 'GUILD_TEXT') {
	if (!channel.isTextBased()) {
		logger.debug('Skip channel processing')
		return
	}
	let options: FetchMessagesOptions = {
		limit: 100,
	}
	let lastActivity = await DiscordActivity.findOne({
		where: {
			channelId: channel.id,
		},
		order: [['createdAt', 'DESC']],
	})
	if (lastActivity) {
		options.after = lastActivity.activityId
	}
	let messages: Array<ActivityRecord> = []
	let fetching = true
	let minMessageDate = new Date() // todo: config value to specify messages old to fetch
	minMessageDate.setDate(minMessageDate.getDate() - 2)
	let lastMessageDate: Date | null = null
	let identityCache = new Map<string, Identity>()
	while (fetching) {
		await channel.messages
			.fetch(options)
			.then(async (pageCollection) => {
				if (!pageCollection.size) {
					fetching = false
					return
				}
				if (lastActivity) {
					for (let msg of pageCollection.values()) {
						options.after = msg.id
						let identity = await getIdentity(msg.author.id, identityCache)
						messages.push(discordMessageToActivity(msg, identity))
					}
				} else {
					for (let msg of pageCollection.values()) {
						if (msg.createdAt < minMessageDate) {
							logger.debug('Skip old message %s in channel %s', msg.createdAt, msg.channel.name)
							fetching = false
							continue
						}
						if (lastMessageDate == null || lastMessageDate > msg.createdAt) {
							options.before = msg.id
							lastMessageDate = msg.createdAt
						}
						let identity = await getIdentity(msg.author.id, identityCache)
						messages.push(discordMessageToActivity(msg, identity))
					}
				}
			})
			.catch((error) => {
				logger.error('Failed to fetch messages history')
				logger.error(error)
				fetching = false
			})
	}

	if (!messages.length) {
		logger.info('No new messages synced')
		return
	}
	logger.info('Fetched %s synced messages', messages.length)
	try {
		await DiscordActivity.bulkCreate(messages)
	} catch (error) {
		logger.error('Failed to save synced messages')
		logger.error(error)
	}
}

async function getIdentity(discordId: string, cache: Map<string, Identity>): Promise<Identity> {
	let identity: Identity | undefined = cache.get(discordId)
	if (identity instanceof Identity) {
		return identity
	}
	identity = await Identity.create({ discord: discordId })
	cache.set(discordId, identity)
	return identity
}

export function discordMessageToActivity(msg: Message, identity: Identity): ActivityRecord {
	return {
		IdentityId: identity.id,
		guildId: msg.guild === null ? '0' : msg.guild.id,
		channelId: msg.channel instanceof TextChannel ? msg.channel.id : null,
		activityId: msg.id,
		activityType: 'post',
		createdAt: msg.createdAt,
	}
}
