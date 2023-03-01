export interface ActivityRecord {
	discordId: string
	guildId: string
	channelId: string | null
	activityId: string
	activityType: string
	createdAt: Date
}
