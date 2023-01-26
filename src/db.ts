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
	declare startDate: Date | null
	declare endDate: Date | null
	declare active: boolean
	declare finalized: boolean
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
	declare guildId: string
	declare channelId: string | null
	declare activityId: string
	declare activityType: string
	declare createdAt: CreationOptional<Date>
	declare identityId: ForeignKey<Identity['id']>
}
DiscordActivity.init(
	{
		id: {
			type: DataTypes.INTEGER.UNSIGNED,
			autoIncrement: true,
			primaryKey: true,
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

export class Identity extends Model<InferAttributes<Identity>, InferCreationAttributes<Identity>> {
	declare id: CreationOptional<number>
	declare address: string | null // chain address
	declare discord: string | null
	declare twitter: string | null
}

Identity.init(
	{
		id: {
			type: DataTypes.INTEGER.UNSIGNED,
			autoIncrement: true,
			primaryKey: true,
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

Identity.hasMany(DiscordActivity, { foreignKey: 'identityId' })
DiscordActivity.belongsTo(Identity, { foreignKey: 'identityId' })

export class Quest extends Model<InferAttributes<Quest>, InferCreationAttributes<Quest>> {
	declare id: CreationOptional<number>
	declare repeat: boolean
	declare source: string
	declare type: string
	declare channelId: string | null
	declare quantity: number
	declare points: number
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
		repeat: {
			type: DataTypes.BOOLEAN,
		},
		source: {
			type: DataTypes.ENUM,
			values: ['discord', 'twitter', 'gamedao'],
		},
		type: {
			type: DataTypes.ENUM,
			values: ['connect', 'join', 'post', 'reaction'],
		},
		channelId: {
			type: DataTypes.STRING(50),
			allowNull: true,
		},
		quantity: {
			type: DataTypes.INTEGER.UNSIGNED,
		},
		points: {
			type: DataTypes.INTEGER.UNSIGNED,
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
			defaultValue: 0
		}
	},
	{
		sequelize
	}
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
			allowNull: false,
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
	declare cid: string | null
	declare name: string | null
	declare points: number | null
	declare level: number | null
	declare total: number
	declare available: number
}
BattlepassReward.init(
	{
		id: {
			type: DataTypes.INTEGER.UNSIGNED,
			autoIncrement: true,
			primaryKey: true,
		},
		cid: {
			type: DataTypes.STRING(50),
		},
		name: {
			type: DataTypes.STRING(100),
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
		}
	},
	{ sequelize }
)

BattlepassReward.belongsTo(Battlepass, { foreignKey: 'battlepassId' })
Battlepass.hasMany(BattlepassReward, { foreignKey: 'battlepassId' })


export async function initDB(): Promise<boolean> {
	try {
		await sequelize.authenticate()
		return true
	} catch (error) {
		return false
	}
}
