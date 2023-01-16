import {
    Sequelize,
    DataTypes
} from 'sequelize';

export interface ChainStatusAttributes {
    blockNumber ? : number

}

export interface ChainStatusInstance {
    id: number;
    createdAt: Date;
    updatedAt: Date;

    blockNumber: number

}

export = (sequelize: Sequelize, DataTypes: DataTypes) => {
    var ChainStatus = sequelize.define('ChainStatus', {
        blockNumber: DataTypes.INTEGER.UNSIGNED
    });

    ChainStatus.associate = function(models) {
        // associations can be defined here
    };

    return ChainStatus;
};
