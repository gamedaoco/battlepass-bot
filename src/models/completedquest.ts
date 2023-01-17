import {
    Sequelize,
    DataTypes
} from 'sequelize';

export interface CompletedQuestAttributes {
    guildId ? : string;

}

export interface CompletedQuestInstance {
    id: number;
    createdAt: Date;
    updatedAt: Date;

    guildId: string;
    questId: number;
    identityId: number;

}

export = (sequelize: Sequelize, DataTypes: DataTypes) => {
    var CompletedQuest = sequelize.define('CompletedQuest', {
        guildId: DataTypes.STRING
    });

    CompletedQuest.associate = function(models) {
        CompletedQuest.hasMany(models.Quest);
        CompletedQuest.hasMany(models.Identity);
    };

    return CompletedQuest;
};
