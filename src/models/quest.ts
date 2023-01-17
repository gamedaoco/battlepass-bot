import {
    Sequelize,
    DataTypes
} from 'sequelize';

export interface QuestAttributes {
    repeat ? : boolean;
    source ? : string;
    type ? : string;
    channelId ? : string;
    quantity ? : number
    points ? : number
    maxDaily ? : number
    battlepassId ? : number

}

export interface QuestInstance {
    id: number;
    createdAt: Date;
    updatedAt: Date;

    repeat: boolean;
    source: string;
    type: string;
    channelId: string;
    quantity: number;
    points: number;
    maxDaily: number;
    battlepassId: number;

}

export = (sequelize: Sequelize, DataTypes: DataTypes) => {
    var Quest = sequelize.define('Quest', {
        repeat: DataTypes.BOOLEAN,
        source: {
            type: DataTypes.ENUM,
            values: ['discord', 'twitter', 'gamedao']
        },
        type: {
            type: DataTypes.ENUM,
            values: ['join', 'post', 'reaction']
        },
        channelId: DataTypes.STRING(50),
        quantity: DataTypes.INTEGER.UNSIGNED,
        points: DataTypes.INTEGER.UNSIGNED,
        maxDaily: DataTypes.INTEGER.UNSIGNED
    });

    Quest.associate = function(models) {
        Quest.hasMany(models.Battlepass);
    };

    return Quest;
};
