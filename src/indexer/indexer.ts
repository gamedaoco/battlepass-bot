import { request, gql } from 'graphql-request';
import { hexToString } from '@polkadot/util';

import { config } from '../config';
import { logger } from '../logger';
import { Battlepass } from '../db';


function getBattlepassesQuery(fromBlock: number) {
	return gql`
	query Battlepasses {
		battlepass(where: {_or: {active_from_block: {_gt: ${fromBlock}}, active_to_block: {_gt: ${fromBlock}}}}) {
  		id
  		active_from_block
  		active_to_block
  		org_id
		}
	}
`;
}

function getUsersQuery(battlePassId: string) {
	return gql`
	query Users {
  	battlepass_nft(where: {battlepass_id: {_eq: "${battlePassId}"}}) {
    	owner_id
  	}
	}
	`;
}

function getTimeQuery() {
	return gql`
	query BlockTime {
      chain_state(limit: 1, order_by: {block_number: desc}) {
        block_number
        timestamp
      }
    }
`;
}

export async function getLastBlockTimestamp(): Promise<[number, Date] | null> {
	let resp: any;
	try {
		resp = await request(config.graph.url, getTimeQuery());
	} catch (error) {
		logger.error('Failed to request events from graph %s', error);
		return null;
	}
	for(let item of resp.chain_state) {
		let blockNumber = item.block_number;
		let date = new Date(item.timestamp);
		return [blockNumber, date];
	}
	logger.error('Not found block info in graph');
	return null;
}

export function calculateBlockDate(knownDate: Date, knownBlock: number, block: number) {
	let offsetSecs = (knownBlock - block) * config.chain.blockTime;
	return new Date(knownDate.getTime() + (1000 * offsetSecs));
}

async function getBattlepasses(
	fromBlock: number, knownBlock: number, knownDate: Date
): Promise<Map<string, any> | null> {
	let resp: any;
	try {
		resp = await request(config.graph.url, getBattlepassesQuery(fromBlock));
	} catch (error) {
		logger.error('Failed to request battlepasses from graph %s', error);
		return null;
	}
	let res = new Map<string, Object>();
	resp.battlepass.forEach((bp: any) => {
		let item = {
			chainId: bp.id,
			orgId: bp.org_id,
			startDate: calculateBlockDate(knownDate, knownBlock, bp.active_from_block),
			endDate: bp.active_to_block ? calculateBlockDate(knownDate, knownBlock, bp.active_to_block) : null,
		};
		res.set(bp.id, item);
	});
	logger.info('Fetched %d battlepasses from graph', res.size);
	return res;
}

export async function getBattlepassUsers(battlePassId: string): Promise<Array<string> | null> {
	let resp: any;
	try {
		resp = await request(config.graph.url, getUsersQuery(battlePassId));
	} catch (error) {
		logger.error('Failed to request battlepass users from graph %s', error);
		return null;
	}
	let res = new Array<string>();
	resp.battlepass_nft.forEach((nft: any) => {
		res.push(nft.owner_id);
	});
	return res;
}

export async function processBattlepasses(
	fromBlock: number, knownBlock: number, knownDate: Date,
	existingBattlepasses: Map<string, Battlepass>,
) {
	let updatedBattlepasses = await getBattlepasses(fromBlock, knownBlock, knownDate);
	if (updatedBattlepasses == null) {
		return;
	}
	for(let [updatedId, updatedBp] of updatedBattlepasses) {
		let existingBp = existingBattlepasses.get(updatedId);
		if (existingBp == undefined) {
			await Battlepass.create({
				chainId: updatedId,
				orgId: updatedBp.orgId,
				startDate: updatedBp.startDate,
				endDate: updatedBp.endDate,
				active: updatedBp.endDate == null,
				finalized: false
			})
			logger.debug('Found new battlepass %s', updatedId);
		} else {
			existingBp.endDate = updatedBp.endDate;
			existingBp.active = updatedBp.endDate == null;
			await existingBp.save();
			logger.debug('Updating infor for %s battlepass', updatedId);
		}
	}
}