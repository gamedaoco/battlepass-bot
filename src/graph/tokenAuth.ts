import jwt, { Secret, JwtPayload } from 'jsonwebtoken'
import { Request, Response, NextFunction } from 'express'

import { config } from '../config'

export function auth(req: Request, res: Response, next: NextFunction) {
	try {
		const token = req.header('Authorization')?.replace('Bearer ', '')

		if (!token) {
			throw new Error()
		}

		jwt.verify(token, config.graph.secretKey)

		next()
	} catch (err) {
		res.status(401).send({
			success: false,
			error: 'Not Authorized',
		})
	}
}
