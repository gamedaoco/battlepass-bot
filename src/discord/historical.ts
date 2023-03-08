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
	Permissions,
	FetchMessagesOptions,
} from 'discord.js'
import { Op } from 'sequelize'

import { config } from '../config'
import { logger } from '../logger'
import { DiscordActivity } from '../db'
import { ActivityRecord } from './interfaces'

export async function syncGuildMembers(guild: Guild) {
	let q = await DiscordActivity.findAll({
		where: {
			guildId: guild.id,
			activityType: 'join'
		},
		attributes: ['discordId']
	})
	let existingActivities = new Set<string>()
	q.map((i: any) => existingActivities.add(i.discordId))
	let newActivities = new Map<string, Date>()
	await guild.members.fetch()
	for (let [_, member] of guild.members.cache) {
		let userId = member.user.id
		if (!existingActivities.has(userId)) {
			newActivities.set(userId, member?.joinedAt || new Date())
		}
	}
	let records = []
	for (let [discordId, createdAt] of newActivities) {
		records.push({
			discordId,
			guildId: guild.id,
			channelId: null,
			activityId: '',
			activityType: 'join',
			createdAt: createdAt,
		})
	}
	if (records.length) {
		await DiscordActivity.bulkCreate(records)
		logger.info('Found %s new users for discord guild %s (%s)', records.length, guild.id, guild.name)
	}
}

export async function getHistoricalEvents(guild: Guild) {
	let newActivities = new Array<ActivityRecord>()
	let p = Promise.resolve()
	await guild.channels.fetch().then(async (channels) => {
		await channels.forEach(async (channel) => {
			if (channel instanceof TextChannel && channel.type == ChannelType.GuildText) {
				if (
					guild.members.me &&
					guild.members.me.permissionsIn(channel).has(['ReadMessageHistory', 'ViewChannel'])
				) {
					p = p.then(() => syncChannelMessages(channel, newActivities))
				}
			}
		})
	})
	p.then(async () => {
		if (!newActivities.length) {
			logger.info('No new messages synced')
			return
		}
		logger.info('Fetched %s new discord activities', newActivities.length)
		try {
			await DiscordActivity.bulkCreate(newActivities)
		} catch (error) {
			logger.error('Failed to save new discord activities')
			logger.error(error)
		}
	})
}

async function syncChannelMessages(channel: TextChannel, newActivities: ActivityRecord[]) {
	if (channel === null) {
		logger.debug('Sync channel is empty')
		return
	}
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
	let fetching = true
	let minMessageDate = new Date()
	minMessageDate.setDate(minMessageDate.getDate() - config.discord.fetchMessagesSince)
	let lastMessageDate: Date | null = null
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
						newActivities.push(discordMessageToActivity(msg))
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
						newActivities.push(discordMessageToActivity(msg))
					}
				}
			})
			.catch((error) => {
				logger.error('Failed to fetch messages history')
				logger.error(error)
				fetching = false
			})
	}
}

export function discordMessageToActivity(msg: Message): ActivityRecord {
	return {
		discordId: msg.author.id,
		guildId: msg.guild === null ? '0' : msg.guild.id,
		channelId: msg.channel instanceof TextChannel ? msg.channel.id : null,
		activityId: msg.id,
		activityType: 'post',
		createdAt: msg.createdAt,
	}
}
