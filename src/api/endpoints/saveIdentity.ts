import { Request, Response } from 'express';
import { Op } from 'sequelize';

import { logger } from '../../logger';
import { IdentitySchema } from '../validations';
import { saveIdentity } from '../controllers';


export async function saveIdentityView(request: Request, response: Response) {
	let validation = IdentitySchema.validate(request.body);
	if (validation.error !== undefined || validation.value === undefined) {
		return response.status(400).send({
			success: false,
			error: validation.error || 'Invalid input'
		});
	}
	let [identity, created] = await saveIdentity(validation.value.discord, validation.value.twitter, validation.value.address);
	return response.status(created ? 201 : 200).send({
		success: true,
		identity
	});
}