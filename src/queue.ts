import { Queue, Worker, Processor } from 'bullmq'
import { config } from './config'
import { logger } from './logger'

export function getQueue(name: 'chain') {
	let q = new Queue(name, {
		connection: config.general.redis,
		defaultJobOptions: {
  			removeOnComplete: true, removeOnFail: 1000
  		}
	})
	q.on('error', (err) => {
		logger.error('Error in the queue %s', name)
		logger.error(err)
	})
	return q
}

export function getWorker(name: 'chain', worker: Processor) {
	let w = new Worker(name, worker, {
		connection: config.general.redis,
		concurrency: 1
	})
	w.on('error', (err) => {
		logger.error('Error in the worker %s', name)
		logger.error(err)
	})
	return w
}
