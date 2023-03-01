import { Message, PartialMessage, GuildMember } from 'discord.js'

import { logger } from '../logger'
import { DiscordActivity, Identity } from '../db'
import { ActivityRecord } from './interfaces'
import { discordMessageToActivity } from './historical'

export async function onMessage(msg: Message) {
	if (msg.author.bot) {
		logger.debug('Skipping bot message')
		return
	}
	if (!msg.channel.isTextBased()) {
		logger.debug('Skip message for non-text channel')
		return
	}
	await DiscordActivity.create(discordMessageToActivity(msg))
}

export async function onMessageDeleted(msg: Message | PartialMessage) {
	if (!(msg instanceof Message)) {
		return
	}
	logger.debug('Process deleted message')
	await DiscordActivity.destroy({
		where: {
			guildId: msg.guild == null ? '0' : msg.guild.id,
			activityId: msg.id,
		},
	})
}

export async function onMemberJoin(member: GuildMember) {
	logger.info('Processing join member')
	let [identity, created] = await Identity.findOrCreate({
		where: { discord: member.user.id },
	})
	await DiscordActivity.findOrCreate({
		where: {
			discordId: member.user.id,
			guildId: member.guild?.id || '',
			activityType: 'join',
		},
		defaults: {
			discordId: member.user.id,
			guildId: member.guild?.id || '',
			activityType: 'join',
			channelId: null,
			activityId: '',
			createdAt: member.joinedAt || new Date(),
		}
	})
}
