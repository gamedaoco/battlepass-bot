import {
    Sequelize,
    DataTypes
} from 'sequelize';

export interface DiscordActivityAttributes {
    guildId ? : string;
    channelId ? : string;
    activityId ? : string;
    identityId ? : number

}

export interface DiscordActivityInstance {
    id: number;
    createdAt: Date;
    updatedAt: Date;

    guildId: string;
    channelId: string;
    activityId: string;
    identityId: number;
    activityType: string;

}

export = (sequelize: Sequelize, DataTypes: DataTypes) => {
    var DiscordActivity = sequelize.define('DiscordActivity', {
        guildId: DataTypes.STRING,
        channelId: DataTypes.STRING,
        activityId: DataTypes.STRING,
        identityId: DataTypes.INTEGER.UNSIGNED,
        activityType: {
            type: DataTypes.ENUM,
            values: ['connect', 'join', 'boost', 'post', 'react']
        }
    });

    DiscordActivity.associate = function(models) {
        DiscordActivity.hasMany(models.Identity);
    };

    return DiscordActivity;
};
