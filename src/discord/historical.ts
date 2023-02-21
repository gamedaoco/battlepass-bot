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
import { DiscordActivity, Identity } from '../db'
import { ActivityRecord } from './interfaces'

export async function syncGuildMembers(guild: Guild) {
	let q = await DiscordActivity.findAll({
		where: {
			guildId: guild.id
		},
		include: [{
			model: Identity,
			required: true,
			where: {
				discord: {
					[Op.ne]: null
				}
			},
			attributes: ['id', 'discord']
		}]
	})
	let existingActivities = new Map<string, number>()
	let newActivities = new Map<string, Date>()
	q.map((i: any) => existingActivities.set(i.Identity.discord, i.identityId))
	await guild.members.fetch()
	for (let [_, member] of guild.members.cache) {
		let userId = member.user.id
		if (!existingActivities.has(userId)) {
			newActivities.set(userId, member?.joinedAt || new Date())
		}
	}
	let newActivitiesUsers = await Identity.findAll({
		where: {
			discord: [...newActivities.keys()]
		},
		attributes: ['id', 'discord']
	})
	let newActivityUsers = new Map<number, Date>()
	let newUsers = new Set<string>([...newActivities.keys()])
	newActivitiesUsers.map((i) => {
		newActivityUsers.set(i.id, newActivities.get(i.discord || '') || new Date())
		newUsers.delete(i.discord || '')
	})
	if (newUsers) {
		let created = await Identity.bulkCreate(
			[...newUsers.values()].map(i => {
				return { discord: i }
			})
		)
		created.map((i) => {
			newActivityUsers.set(i.id, newActivities.get(i.discord || '') || new Date())
		})
	}
	let records = []
	for (let [userId, createdAt] of newActivityUsers) {
		records.push({
			identityId: userId,
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
	let identityCache = new Map<string, Identity>()
	let identities = await Identity.findAll({
		where: {
			discord: {
				[Op.ne]: null,
			},
		},
	})
	identities.map((i: Identity) => {
		identityCache.set(i.discord || '', i)
	})
	let p = Promise.resolve()
	await guild.channels.fetch().then(async (channels) => {
		await channels.forEach(async (channel) => {
			if (channel instanceof TextChannel && channel.type == ChannelType.GuildText) {
				if (
					guild.members.me &&
					guild.members.me.permissionsIn(channel).has(['ReadMessageHistory', 'ViewChannel'])
				) {
					p = p.then(() => syncChannelMessages(channel, newActivities, identityCache))
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

async function syncChannelMessages(
	channel: TextChannel,
	newActivities: ActivityRecord[],
	identityCache: Map<string, Identity>,
) {
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
						let identity = await getIdentity(msg, identityCache, newActivities)
						newActivities.push(discordMessageToActivity(msg, identity))
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
						let identity = await getIdentity(msg, identityCache, newActivities)
						newActivities.push(discordMessageToActivity(msg, identity))
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

async function getIdentity(
	discordMessage: Message,
	cache: Map<string, Identity>,
	newActivities: ActivityRecord[],
): Promise<Identity> {
	let discordId = discordMessage.author.id
	let identity: Identity | undefined = cache.get(discordId)
	if (identity instanceof Identity) {
		return identity
	}
	identity = await Identity.create({ discord: discordId })
	newActivities.push(
		...[
			{
				identityId: identity.id,
				guildId: '',
				channelId: null,
				activityId: '',
				activityType: 'connect',
				createdAt: new Date(),
			},
			{
				identityId: identity.id,
				guildId: discordMessage.guild?.id || '',
				channelId: null,
				activityId: '',
				activityType: 'join',
				createdAt: discordMessage.member?.joinedAt || new Date(),
			},
		],
	)
	cache.set(discordId, identity)
	return identity
}

export function discordMessageToActivity(msg: Message, identity: Identity): ActivityRecord {
	return {
		identityId: identity.id,
		guildId: msg.guild === null ? '0' : msg.guild.id,
		channelId: msg.channel instanceof TextChannel ? msg.channel.id : null,
		activityId: msg.id,
		activityType: 'post',
		createdAt: msg.createdAt,
	}
}
