import { logger } from '../../logger'
import { Battlepass, sequelize } from '../../db'

interface SetFreePassesInterface {
	battlepass: string
	freePasses: number
}

export async function setFreePasses(data: SetFreePassesInterface): Promise<Battlepass | null> {
	return await sequelize.transaction(async (t) => {
		let bp = await Battlepass.findOne({
			where: {
				chainId: data.battlepass
			},
			lock: true,
			transaction: t
		})
		if (!bp) {
			logger.warn('Attempt to modify not existing battlepass %s', data.battlepass)
			return null
		}
		let freePassesBefore = bp.freePasses
		if (data.freePasses > bp.freeClaimed) {
			bp.freePasses = data.freePasses
			await bp.save({
				transaction: t
			})
			return bp
		} else {
			logger.warn(
				'Failed to update battlepass %s free pases from %s to %s',
				data.battlepass, freePassesBefore, data.freePasses
			)
		}
		return null
	})
}
