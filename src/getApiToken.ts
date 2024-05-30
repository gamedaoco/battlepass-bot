import jwt from 'jsonwebtoken'

import { config } from './config'

function getToken(secret: string): string {
	return jwt.sign({ value: 'Using secure API' }, secret)
}

function main() {
	if (!config.graph.secretKey) {
		console.error('API secret key not specified')
		return
	}
	let token = getToken(config.graph.secretKey)
	console.log('Token is', token)
}

main()
