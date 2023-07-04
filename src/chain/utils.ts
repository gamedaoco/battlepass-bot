import { ApiPromise, WsProvider, Keyring } from '@polkadot/api'
import { config } from '../config'

let client: ApiPromise | null

async function connectToNode(): Promise<ApiPromise> {
	const provider = new WsProvider(config.chain.rpcUrl)
	const api = await ApiPromise.create({ provider, noInitWarn: true })
	if (!api.isConnected) {
		throw new Error('Failed to connect to chain RPC node.')
	}
	return api
}

export async function getClient(): Promise<ApiPromise> {
	if (client) {
		return client
	}
	client = await connectToNode()
	return client
}

export function getSigningAccount() {
		return new Keyring({ type: 'sr25519' }).addFromMnemonic(config.chain.account);
}

export function isEventError(api: ApiPromise, event: any) {
	return api.events.system.ExtrinsicFailed.is(event)
}

export function getEventError(api: ApiPromise, dispatchError: any): string {
	if (dispatchError.isModule) {
    const decoded = api.registry.findMetaError(dispatchError.asModule)
    const { name, section } = decoded

    return `${section}.${name}`
  } else {
    return dispatchError.toString()
  }
}

export async function executeTxWithResult(api: ApiPromise, tx: any, successEvent: any): Promise<any> {
	let account = getSigningAccount()
	return new Promise<boolean>(async (resolve, reject) => {
		try {
			let unsub = await tx.signAndSend(account, (res: any) => {
				let { status, events, dispatchError } = res
				if (dispatchError) {
					let error = getEventError(api, dispatchError)
					unsub()
					reject(new Error(error))
					return
				}
	    	events.forEach((item: any) => {
	    		let { event } = item
        	if (successEvent.is(event)) {
	    			unsub()
	    			resolve(event)
	    			return
        	}
	    	})
	    })
		} catch (error) {
			reject(error)
		}
	})
}
