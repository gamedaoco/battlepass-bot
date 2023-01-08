import { Model, InferAttributes, InferCreationAttributes, CreationOptional, Optional, Sequelize, DataTypes, ForeignKey } from 'sequelize';

import { config } from './config';
import { logger } from './logger';


export const sequelize = new Sequelize(config.db.url, {
	logging: msg => logger.debug(msg)
});


export class Battlepass extends Model<InferAttributes<Battlepass>, InferCreationAttributes<Battlepass>> {
	declare id: CreationOptional<number>;
	declare chainId: string;
	declare orgId: string;
	declare startDate: Date | null;
	declare endDate: Date | null;
	declare active: boolean;
	declare finalized: boolean;
}
Battlepass.init(
	{
		id: {
      type: DataTypes.INTEGER.UNSIGNED,
      autoIncrement: true,
      primaryKey: true
    },
    chainId: {
    	type: DataTypes.CHAR(66),
    	allowNull: false,
    },
    orgId: {
    	type: DataTypes.CHAR(66),
    	allowNull: false
    },
    startDate: {
    	type: DataTypes.DATE,
    	allowNull: true
    },
    endDate: {
    	type: DataTypes.DATE,
    	allowNull: true
    },
    active: {
    	type: DataTypes.BOOLEAN,
    	allowNull: false
    },
    finalized: {
    	type: DataTypes.BOOLEAN,
    	allowNull: false
    }
	},
  {
  	indexes: [{
  		unique: false,
  		fields: ['chainId']
  	}],
    sequelize
  }
);


export class DiscordActivity extends Model<InferAttributes<DiscordActivity>, InferCreationAttributes<DiscordActivity>> {
	declare id: CreationOptional<number>;
	declare guildId: string;
	declare channelId: string | null;
	declare activityId: string;
	declare activityType: string;
	declare createdAt: CreationOptional<Date>;
	declare IdentityId: ForeignKey<Identity['id']>;
}
DiscordActivity.init(
	{
	    id: {
	      type: DataTypes.INTEGER.UNSIGNED,
	      autoIncrement: true,
	      primaryKey: true
	    },
	    guildId: {
	    	type: DataTypes.STRING(20),
	    	allowNull: false
	    },
	    channelId: {
	    	type: DataTypes.STRING(50),
	    	allowNull: true,
	    },
	    activityId: {
	    	type: DataTypes.STRING(40),
	    	allowNull: false
	    },
	    activityType: {
	    	type: DataTypes.ENUM,
	    	values: ['connect', 'join', 'boost', 'post', 'react'],
	    },
	    createdAt: {
	    	type: DataTypes.DATE,
	    }
  },
  {
  	// indexes: [{
  	// 	unique: false,
  	// 	fields: ['identityId']
  	// }],
    sequelize
  }
);

export class Identity extends Model<InferAttributes<Identity>, InferCreationAttributes<Identity>> {
	declare id: CreationOptional<number>;
	declare address: string | null;  // chain address
	declare discord: string | null;
	declare twitter: string | null;
}

Identity.init(
	{
	    id: {
	      type: DataTypes.INTEGER.UNSIGNED,
	      autoIncrement: true,
	      primaryKey: true
	    },
	    address: {
	    	type: DataTypes.CHAR(48),
	    	allowNull: true
	    },
	    discord: {
	    	type: DataTypes.STRING(20),
	    	allowNull: true
	    },
	    twitter: {
	    	type: DataTypes.STRING(20),
	    	allowNull: true,
	    }
  },
  {
    sequelize
  }
);

Identity.hasMany(DiscordActivity);
DiscordActivity.belongsTo(Identity);


export class Quest extends Model<InferAttributes<Quest>, InferCreationAttributes<Quest>> {
	declare id: CreationOptional<number>;
	declare repeat: boolean;
	declare source: string;
	declare type: string;
	declare channelId: string | null;
	declare quantity: number;
	declare points: number;
	declare maxDaily: number | null;
	declare BattlepassId: ForeignKey<Battlepass['id']>;
}
Quest.init(
	{
		id: {
      type: DataTypes.INTEGER.UNSIGNED,
      autoIncrement: true,
      primaryKey: true
    },
    repeat: {
    	type: DataTypes.BOOLEAN,
    },
    source: {
    	type: DataTypes.ENUM,
    	values: ['discord', 'twitter', 'gamedao']
    },
    type: {
    	type: DataTypes.ENUM,
    	values: ['post', 'reaction']
    },
    channelId: {
    	type: DataTypes.STRING(50),
    	allowNull: true
    },
    quantity: {
    	type: DataTypes.INTEGER.UNSIGNED,
    },
    points: {
    	type: DataTypes.INTEGER.UNSIGNED,
    },
    maxDaily: {
    	type: DataTypes.INTEGER.UNSIGNED,
    	allowNull: true
    },
	},
	{
		sequelize
	}
)

Battlepass.hasMany(Quest);
Quest.belongsTo(Battlepass);


export class ChainStatus extends Model<InferAttributes<ChainStatus>, InferCreationAttributes<ChainStatus>> {
	declare id: CreationOptional<number>;
	declare blockNumber: number;
}
ChainStatus.init(
	{
	    id: {
	      type: DataTypes.INTEGER.UNSIGNED,
	      autoIncrement: true,
	      primaryKey: true
	    },
	    blockNumber: {
	    	type: DataTypes.INTEGER.UNSIGNED,
	    	allowNull: false
	    }
  },
  {
    sequelize
  }
);


export class CompletedQuest extends Model<InferAttributes<CompletedQuest>, InferCreationAttributes<CompletedQuest>> {
	declare id: CreationOptional<number>;
	declare guildId: string;
	declare createdAt: CreationOptional<Date>;
	declare updatedAt: CreationOptional<Date>;
	declare IdentityId: ForeignKey<Identity['id']>;
	declare QuestId: ForeignKey<Quest['id']>;
}
CompletedQuest.init(
	{
		id: {
      type: DataTypes.INTEGER.UNSIGNED,
      autoIncrement: true,
      primaryKey: true
    },
    guildId: {
    	type: DataTypes.STRING(20),
    	allowNull: false
    },
    createdAt: {
    	type: DataTypes.DATE,
    },
    updatedAt: {
    	type: DataTypes.DATE,
    }
	},
  {
    sequelize
  }
);

CompletedQuest.belongsTo(Identity);
Identity.hasMany(CompletedQuest);
CompletedQuest.belongsTo(Quest);
Quest.hasMany(CompletedQuest);


export async function initDB(): Promise<boolean> {
	try {
		await sequelize.authenticate();
		return true;
	} catch (error) {
		return false;
	}
}
