import {
	Model,
	InferAttributes,
	InferCreationAttributes,
	CreationOptional,
	Optional,
	Sequelize,
	DataTypes,
	ForeignKey,
} from 'sequelize'

import { config } from './config'
import { logger } from './logger'

export const sequelize = new Sequelize(config.db.url, {
	logging: (msg) => logger.debug(msg),
})

export class Battlepass extends Model<InferAttributes<Battlepass>, InferCreationAttributes<Battlepass>> {
	declare id: CreationOptional<number>
	declare chainId: string
	declare orgId: string
	declare name: string | null
	declare cid: string | null
	declare season: number | null
	declare price: number | null
	declare startDate: Date | null
	declare endDate: Date | null
	declare active: boolean
	declare finalized: boolean
	declare joinable: CreationOptional<boolean>
	declare totalJoined: CreationOptional<number>
	declare freePasses: CreationOptional<number>
	declare freeClaimed: CreationOptional<number>
	declare premiumPasses: CreationOptional<number>
	declare premiumClaimed: CreationOptional<number>
}
Battlepass.init(
	{
		id: {
			type: DataTypes.INTEGER.UNSIGNED,
			autoIncrement: true,
			primaryKey: true,
		},
		chainId: {
			type: DataTypes.CHAR(66),
			allowNull: false,
		},
		orgId: {
			type: DataTypes.CHAR(66),
			allowNull: false,
		},
		name: {
			type: DataTypes.STRING(100),
			allowNull: true,
		},
		cid: {
			type: DataTypes.STRING(50),
			allowNull: true,
		},
		season: {
			type: DataTypes.INTEGER,
			allowNull: true
		},
		price: {
			type: DataTypes.INTEGER,
			allowNull: true
		},
		startDate: {
			type: DataTypes.DATE,
			allowNull: true,
		},
		endDate: {
			type: DataTypes.DATE,
			allowNull: true,
		},
		active: {
			type: DataTypes.BOOLEAN,
			allowNull: false,
		},
		finalized: {
			type: DataTypes.BOOLEAN,
			allowNull: false,
		},
		joinable: {
			type: DataTypes.BOOLEAN,
			allowNull: false,
			defaultValue: true
		},
		totalJoined: {
			type: DataTypes.INTEGER,
			allowNull: false,
			defaultValue: 0
		},
		freePasses: {
			type: DataTypes.INTEGER,
			allowNull: false,
			defaultValue: 0
		},
		freeClaimed: {
			type: DataTypes.INTEGER,
			allowNull: false,
			defaultValue: 0
		},
		premiumPasses: {
			type: DataTypes.INTEGER,
			allowNull: true,
			defaultValue: null
		},
		premiumClaimed: {
			type: DataTypes.INTEGER,
			allowNull: false,
			defaultValue: 0
		},
	},
	{
		indexes: [
			{
				unique: false,
				fields: ['chainId'],
			},
		],
		sequelize,
	},
)

export class DiscordActivity extends Model<InferAttributes<DiscordActivity>, InferCreationAttributes<DiscordActivity>> {
	declare id: CreationOptional<number>
	declare discordId: string
	declare guildId: string
	declare channelId: string | null
	declare activityId: string
	declare activityType: string
	declare createdAt: CreationOptional<Date>
}
DiscordActivity.init(
	{
		id: {
			type: DataTypes.INTEGER.UNSIGNED,
			autoIncrement: true,
			primaryKey: true,
		},
		discordId: {
			type: DataTypes.STRING(20),
			allowNull: false,
		},
		guildId: {
			type: DataTypes.STRING(20),
			allowNull: false,
		},
		channelId: {
			type: DataTypes.STRING(50),
			allowNull: true,
		},
		activityId: {
			type: DataTypes.STRING(40),
			allowNull: false,
		},
		activityType: {
			type: DataTypes.ENUM,
			values: ['connect', 'join', 'boost', 'post', 'react'],
		},
		createdAt: {
			type: DataTypes.DATE,
		},
	},
	{
		sequelize,
	},
)

export class TwitterActivity extends Model<InferAttributes<TwitterActivity>, InferCreationAttributes<TwitterActivity>> {
	declare id: CreationOptional<number>
	declare activityId: string | null
	declare activityType: string
	declare authorId: string | null // author of performed activity
	declare objectId: string | null // object, on which activity was performed
	declare objectAuthor: string | null // author of the object
	declare createdAt: CreationOptional<Date>
}
TwitterActivity.init(
	{
		id: {
			type: DataTypes.INTEGER.UNSIGNED,
			autoIncrement: true,
			primaryKey: true,
		},
		authorId: {
			type: DataTypes.STRING(40),
			allowNull: true,
		},
		activityId: {
			type: DataTypes.STRING(40),
			allowNull: true,
		},
		objectAuthor: {
			type: DataTypes.STRING(40),
			allowNull: true,
		},
		objectId: {
			type: DataTypes.STRING(40),
			allowNull: true,
		},
		activityType: {
			type: DataTypes.ENUM,
			values: ['connect', 'tweet', 'retweet', 'follow', 'comment', 'like'],
		},
		createdAt: {
			type: DataTypes.DATE,
		},
	},
	{ sequelize },
)

export class ChainActivity extends Model<InferAttributes<ChainActivity>, InferCreationAttributes<ChainActivity>> {
	declare id: CreationOptional<number>
	declare address: string
	declare activityType: string
	declare createdAt: CreationOptional<Date>
}
ChainActivity.init(
	{
		id: {
			type: DataTypes.INTEGER.UNSIGNED,
			autoIncrement: true,
			primaryKey: true,
		},
		address: {
			type: DataTypes.CHAR(48),
			allowNull: false,
		},
		activityType: {
			type: DataTypes.ENUM,
			values: ['connect', 'identity'],
			allowNull: false
		},
		createdAt: {
			type: DataTypes.DATE,
		},
	},
	{ sequelize },
)

export class Identity extends Model<InferAttributes<Identity>, InferCreationAttributes<Identity>> {
	declare id: CreationOptional<number>
	declare uuid: string | null
	declare address: string | null // chain address
	declare discord: string | null
	declare twitter: string | null
	declare cid: string | null
	declare name: string | null
	declare email: string | null
}

Identity.init(
	{
		id: {
			type: DataTypes.INTEGER.UNSIGNED,
			autoIncrement: true,
			primaryKey: true,
		},
		uuid: {
			type: DataTypes.UUID,
			defaultValue: DataTypes.UUIDV4,
			allowNull: false,
		},
		address: {
			type: DataTypes.CHAR(48),
			allowNull: true,
		},
		discord: {
			type: DataTypes.STRING(20),
			allowNull: true,
		},
		twitter: {
			type: DataTypes.STRING(20),
			allowNull: true,
		},
		cid: {
			type: DataTypes.STRING(50),
			allowNull: true,
		},
		name: {
			type: DataTypes.STRING(50),
			allowNull: true,
		},
		email: {
			type: DataTypes.STRING(50),
			allowNull: true,
		},
	},
	{
		sequelize,
		indexes: [
			{
				unique: false,
				fields: ['address'],
			},
		],
	},
)

export class Quest extends Model<InferAttributes<Quest>, InferCreationAttributes<Quest>> {
	declare id: CreationOptional<number>
	declare name: string | null
	declare description: string | null
	declare link: string | null
	declare cid: string | null
	declare repeat: boolean
	declare source: string
	declare type: string
	declare channelId: string | null
	declare guildId: string | null
	declare hashtag: string | null
	declare twitterId: string | null
	declare quantity: number
	declare points: number
	declare max: number | null
	declare maxDaily: number | null
	declare battlepassId: ForeignKey<Battlepass['id']>
}
Quest.init(
	{
		id: {
			type: DataTypes.INTEGER.UNSIGNED,
			autoIncrement: true,
			primaryKey: true,
		},
		name: {
			type: DataTypes.STRING(100),
		},
		description: {
			type: DataTypes.STRING(512),
		},
		link: {
			type: DataTypes.STRING(150),
		},
		cid: {
			type: DataTypes.STRING(50),
		},
		repeat: {
			type: DataTypes.BOOLEAN,
		},
		source: {
			type: DataTypes.ENUM,
			values: ['discord', 'twitter', 'gamedao'],
		},
		type: {
			type: DataTypes.ENUM,
			values: [
				'connect',
				'join', // general
				'post',
				'reaction', // discord
				'tweet',
				'like',
				'retweet',
				'comment',
				'follow', // twitter
				'identity', // gamedao
			],
		},
		guildId: {
			type: DataTypes.STRING(50),
			allowNull: true,
		},
		channelId: {
			type: DataTypes.STRING(50),
			allowNull: true,
		},
		hashtag: {
			type: DataTypes.STRING(50),
			allowNull: true,
		},
		twitterId: {
			type: DataTypes.STRING(30),
			allowNull: true,
		},
		quantity: {
			type: DataTypes.INTEGER.UNSIGNED,
		},
		points: {
			type: DataTypes.INTEGER.UNSIGNED,
		},
		max: {
			type: DataTypes.INTEGER.UNSIGNED,
			allowNull: true,
		},
		maxDaily: {
			type: DataTypes.INTEGER.UNSIGNED,
			allowNull: true,
		},
	},
	{
		sequelize,
	},
)

Battlepass.hasMany(Quest, { foreignKey: 'battlepassId' })
Quest.belongsTo(Battlepass, { foreignKey: 'battlepassId' })

export class QuestProgress extends Model<InferAttributes<QuestProgress>, InferCreationAttributes<QuestProgress>> {
	declare id: CreationOptional<number>
	declare questId: ForeignKey<Quest['id']>
	declare identityId: ForeignKey<Identity['id']>
	declare progress: number
}
QuestProgress.init(
	{
		id: {
			type: DataTypes.INTEGER.UNSIGNED,
			autoIncrement: true,
			primaryKey: true,
		},
		progress: {
			type: DataTypes.DOUBLE,
			allowNull: false,
			defaultValue: 0,
		},
	},
	{
		sequelize,
	},
)

Quest.hasMany(QuestProgress, { foreignKey: 'questId' })
QuestProgress.belongsTo(Quest, { foreignKey: 'questId' })
Identity.hasMany(QuestProgress, { foreignKey: 'identityId' })
QuestProgress.belongsTo(Identity, { foreignKey: 'identityId' })

export class ChainStatus extends Model<InferAttributes<ChainStatus>, InferCreationAttributes<ChainStatus>> {
	declare id: CreationOptional<number>
	declare blockNumber: number
}
ChainStatus.init(
	{
		id: {
			type: DataTypes.INTEGER.UNSIGNED,
			autoIncrement: true,
			primaryKey: true,
		},
		blockNumber: {
			type: DataTypes.INTEGER.UNSIGNED,
			allowNull: false,
		},
	},
	{
		sequelize,
	},
)

export class CompletedQuest extends Model<InferAttributes<CompletedQuest>, InferCreationAttributes<CompletedQuest>> {
	declare id: CreationOptional<number>
	declare guildId: string
	declare createdAt: CreationOptional<Date>
	declare updatedAt: CreationOptional<Date>
	declare identityId: ForeignKey<Identity['id']>
	declare questId: ForeignKey<Quest['id']>
}
CompletedQuest.init(
	{
		id: {
			type: DataTypes.INTEGER.UNSIGNED,
			autoIncrement: true,
			primaryKey: true,
		},
		guildId: {
			type: DataTypes.STRING(20),
			allowNull: true,
		},
		createdAt: {
			type: DataTypes.DATE,
		},
		updatedAt: {
			type: DataTypes.DATE,
		},
	},
	{
		sequelize,
	},
)

CompletedQuest.belongsTo(Identity, { foreignKey: 'identityId' })
Identity.hasMany(CompletedQuest, { foreignKey: 'identityId' })
CompletedQuest.belongsTo(Quest, { foreignKey: 'questId' })
Quest.hasMany(CompletedQuest, { foreignKey: 'questId' })

export class BattlepassParticipant extends Model<
	InferAttributes<BattlepassParticipant>,
	InferCreationAttributes<BattlepassParticipant>
> {
	declare id: CreationOptional<number>
	declare premium: boolean
	declare status: CreationOptional<string>
	declare points: CreationOptional<number>
	declare passChainId: string | null
	declare identityId: ForeignKey<Identity['id']>
	declare battlepassId: ForeignKey<Battlepass['id']>
}
BattlepassParticipant.init(
	{
		id: {
			type: DataTypes.INTEGER.UNSIGNED,
			autoIncrement: true,
			primaryKey: true,
		},
		points: {
			type: DataTypes.INTEGER,
			allowNull: false,
			defaultValue: 0
		},
		premium: {
			type: DataTypes.BOOLEAN,
			defaultValue: false
		},
		status: {
			type: DataTypes.ENUM,
			values: ['free', 'pendingPayment', 'pending', 'synced'],
			defaultValue: 'free',
			allowNull: false,
		},
		passChainId: {
			type: DataTypes.CHAR(66),
			allowNull: true
		},
	},
	{ sequelize },
)

BattlepassParticipant.belongsTo(Identity, { foreignKey: 'identityId' })
Identity.hasMany(BattlepassParticipant, { foreignKey: 'identityId' })
BattlepassParticipant.belongsTo(Battlepass, { foreignKey: 'battlepassId' })
Battlepass.hasMany(BattlepassParticipant, { foreignKey: 'battlepassId' })

export class BattlepassReward extends Model<
	InferAttributes<BattlepassReward>,
	InferCreationAttributes<BattlepassReward>
> {
	declare id: CreationOptional<number>
	declare battlepassId: ForeignKey<Battlepass['id']>
	declare name: string | null
	declare description: string | null
	declare cid: string | null
	declare chainId: string | null
	declare points: number | null
	declare level: number | null
	declare total: number
	declare available: number
	declare syncStatus: CreationOptional<string>
}
BattlepassReward.init(
	{
		id: {
			type: DataTypes.INTEGER.UNSIGNED,
			autoIncrement: true,
			primaryKey: true,
		},
		name: {
			type: DataTypes.STRING(100),
		},
		description: {
			type: DataTypes.STRING(512),
		},
		cid: {
			type: DataTypes.STRING(50),
		},
		chainId: {
			type: DataTypes.CHAR(66),
			allowNull: true,
		},
		points: {
			type: DataTypes.INTEGER.UNSIGNED,
		},
		level: {
			type: DataTypes.INTEGER.UNSIGNED,
		},
		total: {
			type: DataTypes.INTEGER.UNSIGNED,
		},
		available: {
			type: DataTypes.INTEGER.UNSIGNED,
		},
		syncStatus: {
			type: DataTypes.ENUM,
			values: ['pending', 'synced', 'failed'],
			defaultValue: 'pending'
		}
	},
	{ sequelize },
)

BattlepassReward.belongsTo(Battlepass, { foreignKey: 'battlepassId' })
Battlepass.hasMany(BattlepassReward, { foreignKey: 'battlepassId' })

export class BattlepassLevel extends Model<InferAttributes<BattlepassLevel>, InferCreationAttributes<BattlepassLevel>> {
	declare id: CreationOptional<number>
	declare battlepassId: ForeignKey<Battlepass['id']>
	declare name: string | null
	declare points: number
	declare totalPoints: number
	declare level: number
	declare syncStatus: CreationOptional<string>
}
BattlepassLevel.init(
	{
		id: {
			type: DataTypes.INTEGER.UNSIGNED,
			autoIncrement: true,
			primaryKey: true,
		},
		name: {
			type: DataTypes.STRING(100),
		},
		points: {
			type: DataTypes.INTEGER.UNSIGNED,
			allowNull: false,
		},
		totalPoints: {
			type: DataTypes.INTEGER.UNSIGNED,
			allowNull: false,
		},
		level: {
			type: DataTypes.INTEGER.UNSIGNED,
			allowNull: false,
		},
		syncStatus: {
			type: DataTypes.ENUM,
			values: ['pending', 'synced', 'failed'],
			defaultValue: 'pending'
		}
	},
	{ sequelize },
)

BattlepassLevel.belongsTo(Battlepass, { foreignKey: 'battlepassId' })
Battlepass.hasMany(BattlepassLevel, { foreignKey: 'battlepassId' })

export class TwitterSearch extends Model<InferAttributes<TwitterSearch>, InferCreationAttributes<TwitterSearch>> {
	declare id: CreationOptional<number>
	declare query: string
	declare executedAt: Date
}
TwitterSearch.init(
	{
		id: {
			type: DataTypes.INTEGER.UNSIGNED,
			autoIncrement: true,
			primaryKey: true,
		},
		query: {
			type: DataTypes.STRING(100),
		},
		executedAt: {
			type: DataTypes.DATE,
			allowNull: false,
		},
	},
	{ sequelize },
)

export class TwitterUser extends Model<InferAttributes<TwitterUser>, InferCreationAttributes<TwitterUser>> {
	declare id: CreationOptional<number>
	declare username: string
	declare twitterId: string
}
TwitterUser.init(
	{
		id: {
			type: DataTypes.INTEGER.UNSIGNED,
			autoIncrement: true,
			primaryKey: true,
		},
		username: {
			type: DataTypes.STRING(40),
			allowNull: false
		},
		twitterId: {
			type: DataTypes.STRING(40),
			allowNull: false
		},
	},
	{ sequelize },
)

export class Payment extends Model<InferAttributes<Payment>, InferCreationAttributes<Payment>> {
	declare id: CreationOptional<number>
	declare participantId: ForeignKey<BattlepassParticipant['id']>
	declare paymentToken: string
	declare createdAt: CreationOptional<Date>
}
Payment.init(
	{
		id: {
			type: DataTypes.INTEGER.UNSIGNED,
			autoIncrement: true,
			primaryKey: true,
		},
		paymentToken: {
			type: DataTypes.STRING(120),
			allowNull: false
		},
		createdAt: {
			type: DataTypes.DATE,
		},
	},
	{ sequelize }
)
Payment.belongsTo(BattlepassParticipant, { foreignKey: 'participantId' })
BattlepassParticipant.hasOne(Payment, { foreignKey: 'participantId' })

export class RewardClaim extends Model<InferAttributes<RewardClaim>, InferCreationAttributes<RewardClaim>> {
	declare id: CreationOptional<number>
	declare nftId: number | null
	declare syncStatus: CreationOptional<string>
	declare rewardId: ForeignKey<BattlepassReward['id']>
	declare participantId: ForeignKey<BattlepassParticipant['id']>
}
RewardClaim.init(
	{
		id: {
			type: DataTypes.INTEGER.UNSIGNED,
			autoIncrement: true,
			primaryKey: true,
		},
		nftId: {
			type: DataTypes.INTEGER.UNSIGNED,
			allowNull: true
		},
		syncStatus: {
			type: DataTypes.ENUM,
			values: ['pending', 'synced', 'failed'],
			defaultValue: 'pending'
		}
	},
	{ sequelize }
)
RewardClaim.belongsTo(BattlepassReward, { foreignKey: 'rewardId' })
BattlepassReward.hasMany(RewardClaim, { foreignKey: 'rewardId' })
RewardClaim.belongsTo(BattlepassParticipant, { foreignKey: 'participantId' })
BattlepassParticipant.hasMany(RewardClaim, { foreignKey: 'participantId' })

export class UserToken extends Model<InferAttributes<UserToken>, InferCreationAttributes<UserToken>> {
	declare id: CreationOptional<number>
	declare source: string
	declare token: string
	declare identityId: ForeignKey<Identity['id']>
}
UserToken.init(
	{
		id: {
			type: DataTypes.INTEGER.UNSIGNED,
			autoIncrement: true,
			primaryKey: true,
		},
		source: {
			type: DataTypes.ENUM,
			values: ['twitter'],
			allowNull: false
		},
		token: {
			type: DataTypes.STRING(100),
			allowNull: false
		}
	},
	{ sequelize }
)
UserToken.belongsTo(Identity, { foreignKey: 'identityId' })
Identity.hasMany(UserToken, { foreignKey: 'identityId' })

export async function initDB(): Promise<boolean> {
	try {
		await sequelize.authenticate()
		return true
	} catch (error) {
		logger.error(error)
		return false
	}
}
