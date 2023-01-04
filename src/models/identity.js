import {
    Sequelize,
    DataTypes
} from 'sequelize';

export interface IdentityAttributes {
    discord ? : string;
    address ? : string;
    twitter ? : string;

}

export interface IdentityInstance {
    id: number;
    createdAt: Date;
    updatedAt: Date;

    discord: string | null;
    address: string | null;
    twitter: string | null;

}

export = (sequelize: Sequelize, DataTypes: DataTypes) => {
    var Identity = sequelize.define('Identity', {
        discord: DataTypes.STRING(20),
        address: DataTypes.CHAR(48),
        twitter: DataTypes.STRING(20)
    });

    Identity.associate = function(models) {
        Identity.belongsTo(models.DiscordActivity);
        Identity.belongsTo(models.CompletedQuest);
    };

    return Identity;
};
