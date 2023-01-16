import { Op } from 'sequelize';
import { Request, Response } from 'express';

import { logger } from '../../logger';
import { PointUpdatesSchema } from '../validations';
import { getPoints } from '../controllers';


export async function getPointsView(request: Request, response: Response) {
	let validation = PointUpdatesSchema.validate(request.query);
	if (validation.error != undefined || validation.value === undefined) {
		return response.status(400).send({
			success: false,
			error: validation.error || 'Invalid input'
		});
	}
	let data = await getPoints(validation.value.battlepass, validation.value.since, validation.value.address);
	return response.status(200).send({
		success: true,
		points: data
	});
}
