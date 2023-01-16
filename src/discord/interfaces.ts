export interface ActivityRecord {
	IdentityId: number;
	guildId: string;
	channelId: string | null;
	activityId: string;
	activityType: string;
	createdAt: Date;
}