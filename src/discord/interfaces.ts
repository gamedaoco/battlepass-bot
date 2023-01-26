export interface ActivityRecord {
	identityId: number
	guildId: string
	channelId: string | null
	activityId: string
	activityType: string
	createdAt: Date
}
