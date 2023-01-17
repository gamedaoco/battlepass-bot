import { describe, expect, test, it, beforeEach, beforeAll } from '@jest/globals'
import request = require('supertest')

import truncate from '../truncate'
import { initDB, sequelize, Identity, Battlepass, Quest, CompletedQuest } from '../../db'
import { app } from '../../api/server'


describe('Get battlepass quests', () => {

  beforeAll(async () => {
    await initDB();
    await sequelize.sync({force: true});
  });

  beforeEach(async () => {
    await truncate();
  });

  let prepare = async function() {
    // battlepasses
    let bp1 = await Battlepass.create({
      chainId: '111111111111111111111111111111111111111111111111111111111111111111',
      orgId: '222222222222222222222222222222222222222222222222222222222222222222',
      startDate: new Date('2022-12-31T23:59:59Z'),
      active: true,
      finalized: false
    });
    let bp2 = await Battlepass.create({
      chainId: '333333333333333333333333333333333333333333333333333333333333333333',
      orgId: '444444444444444444444444444444444444444444444444444444444444444444',
      startDate: new Date('2023-01-01T11:50:00Z'),
      active: true,
      finalized: false
    });

    // battlepass quests
    let bp1q1 = await Quest.create({
      repeat: false,
      source: 'discord',
      type: 'post',
      channelId: null,
      quantity: 5,
      points: 1000,
      BattlepassId: bp1.id
    });
    let bp1q2 = await Quest.create({
      repeat: true,
      source: 'discord',
      type: 'post',
      channelId: '111111111111111111',
      quantity: 10,
      points: 500,
      maxDaily: 5,
      BattlepassId: bp1.id
    });
    let bp2q1 = await Quest.create({
      repeat: false,
      source: 'discord',
      type: 'post',
      channelId: null,
      quantity: 5,
      points: 1000,
      BattlepassId: bp2.id
    });
    let bp2q2 = await Quest.create({
      repeat: true,
      source: 'discord',
      type: 'post',
      channelId: '111111111111111111',
      quantity: 10,
      points: 500,
      maxDaily: 5,
      BattlepassId: bp2.id
    });
  }

  test('Get quests for existing battlepass', async () => {
    await prepare();

    const res = await request(app)
      .get('/api/quests')
      .query({
        battlepass: '111111111111111111111111111111111111111111111111111111111111111111'
      })
      .set('Accept', 'application/json')
      .expect(200)
      .then(async (response: any) => {
        expect(response.body.success).toBeTruthy();
        expect(response.body.quests.length).toBe(2);

        expect(response.body.quests[0].daily).toBeFalsy();
        expect(response.body.quests[0].source).toBe('discord');
        expect(response.body.quests[0].type).toBe('post');
        expect(response.body.quests[0].channelId).toBeNull();
        expect(response.body.quests[0].quantity).toBe(5);
        expect(response.body.quests[0].points).toBe(1000);

        expect(response.body.quests[1].daily).toBeTruthy();
        expect(response.body.quests[1].source).toBe('discord');
        expect(response.body.quests[1].type).toBe('post');
        expect(response.body.quests[1].channelId).toBe('111111111111111111');
        expect(response.body.quests[1].quantity).toBe(10);
        expect(response.body.quests[1].points).toBe(500);
        expect(response.body.quests[1].maxDaily).toBe(5);
      });
  });

  test('Get quests for non-existing battlepass', async () => {
    const res = await request(app)
      .get('/api/quests')
      .query({
        battlepass: '5'.padEnd(66)
      })
      .set('Accept', 'application/json')
      .expect(200)
      .then(async (response: any) => {
        expect(response.body.success).toBeTruthy();
        expect(response.body.quests.length).toBe(0);
      });
  });

});
