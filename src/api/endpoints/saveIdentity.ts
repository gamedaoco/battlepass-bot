import { Request, Response } from 'express';
import { Op } from 'sequelize';

import { logger } from '../../logger';
import { Identity } from '../../db';
import { IdentitySchema } from '../validations';


export async function saveIdentity(request: Request, response: Response) {
	let validation = IdentitySchema.validate(request.body);
	if (validation.error != undefined || validation.value === undefined) {
		return response.status(400).send({
			success: false,
			error: validation.error || 'Invalid input'
		});
	}
	let orClause = [];
	if (validation.value.discord) {
		orClause.push({discord: validation.value.discord});
	}
	if (validation.value.twitter) {
		orClause.push({twitter: validation.value.twitter});
	}
	if (validation.value.address) {
		orClause.push({address: validation.value.address});
	}
	try {
		let [identity, created] = await Identity.findOrCreate({
			where: {
				[Op.or]: orClause
			},
			defaults: {
				discord: validation.value.discord,
				twitter: validation.value.twitter,
				address: validation.value.address,
			}
		})
		if (!created) {
			identity.discord = validation.value.discord;
			identity.twitter = validation.value.twitter;
			identity.address = validation.value.address;
			await identity.save();
		}
		logger.debug('Created identity');
		return response.status(created ? 201 : 200).send({
			success: true,
			identity
		})
	} catch (e) {
		logger.error('Failed to store identity %s', e);
		return response.status(500).send({
			success: false,
			error: 'Failed to create identity'
		});
	}
}