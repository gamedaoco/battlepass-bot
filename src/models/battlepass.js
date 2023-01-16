import {
    Sequelize,
    DataTypes
} from 'sequelize';

export interface BattlepassAttributes {
    chainId ? : string;
    orgId ? : string;
    startDate ? : Date;
    endDate ? : Date;
    active ? : boolean;
    finalized ? : boolean;

}

export interface BattlepassInstance {
    id: number;
    createdAt: Date;
    updatedAt: Date;

    chainId: string;
    orgId: string;
    startDate: Date;
    endDate: Date;
    active: boolean;
    finalized: boolean;

}

export = (sequelize: Sequelize, DataTypes: DataTypes) => {
    var Battlepass = sequelize.define('Battlepass', {
        chainId: DataTypes.CHAR(66),
        orgId: DataTypes.CHAR(66),
        startDate: DataTypes.DATE,
        endDate: DataTypes.DATE,
        active: {
            type: DataTypes.BOOLEAN,
            allowNull: false
        },
        finalized: {
            type: DataTypes.BOOLEAN,
            allowNull: false
        }
    });

    Battlepass.associate = function(models) {
        Battlepass.belongsTo(models.Quest);
    };

    return Battlepass;
};
