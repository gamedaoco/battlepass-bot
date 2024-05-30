import { GraphQLError } from 'graphql'
import { logger } from '../../logger'
import { Battlepass, sequelize } from '../../db'

interface UpdateBattlepassInterface {
	battlepass: string
	freePasses: number | null
	premiumPasses: number | null
	joinable: boolean | null
}


export async function updateBattlepass(data: UpdateBattlepassInterface) {
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
			throw new GraphQLError('Invalid input', {
				extensions: { code: 'BAD_USER_INPUT', description: 'Battlepass not found' },
			})
		}
		if (data.freePasses != null) {
			if (bp.freeClaimed > data.freePasses) {
				throw new GraphQLError('Invalid input', {
					extensions: { code: 'BAD_USER_INPUT', description: 'Free passes limit exceeded' },
				})
			}
			bp.freePasses = data.freePasses
		}
		if (data.premiumPasses != null) {
			if (bp.premiumClaimed > data.premiumPasses) {
				throw new GraphQLError('Invalid input', {
					extensions: { code: 'BAD_USER_INPUT', description: 'Premium passes limit exceeded' },
				})
			}
			bp.premiumPasses = data.premiumPasses
		}
		if (data.joinable != null) {
			bp.joinable = data.joinable
		}
		await bp.save({
			transaction: t
		})
		return bp
	})
}
