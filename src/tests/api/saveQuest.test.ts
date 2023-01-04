import { describe, expect, test, it, beforeEach, beforeAll } from '@jest/globals';
import request = require('supertest');
import assert = require("assert")

import truncate from '../truncate';
import { initDB, sequelize, Battlepass } from '../../db';
import { app } from '../../api/server';


describe('Save new quest', () => {

  beforeAll(async () => {
    await initDB();
    await sequelize.sync({force: true});
  });

  beforeEach(async () => {
    await truncate();
  });
  let chainId = '111111111111111111111111111111111111111111111111111111111111111111';
  let orgId = '222222222222222222222222222222222222222222222222222222222222222222';

  test('New non-repeatable quest', async () => {
    let battlepass = await Battlepass.create({
      chainId,
      orgId,
      startDate: new Date(),
      active: true,
      finalized: false
    });

    const res = await request(app)
      .post('/api/quest')
      .send({
        battlepass: battlepass.chainId,
        daily: false,
        source: 'discord',
        type: 'post',
        quantity: 100,
        points: 5000
      })
      .set('Accept', 'application/json')
      .expect(201)
      .then((response: any) => {
        console.log(JSON.stringify(response.body));
        assert(response.body.success === true);
        assert(response.body.quest.repeat === false);
        assert(response.body.quest.source === 'discord');
        assert(response.body.quest.type === 'post');
        assert(response.body.quest.quantity === 100);
        assert(response.body.quest.points === 5000);
      });
  });

  test('New daily quest', async () => {
    let battlepass = await Battlepass.create({
      chainId: '111111111111111111111111111111111111111111111111111111111111111111',
      orgId: '222222222222222222222222222222222222222222222222222222222222222222',
      startDate: new Date(),
      active: true,
      finalized: false
    });

    const res = await request(app)
      .post('/api/quest')
      .send({
        battlepass: battlepass.chainId,
        daily: true,
        maxDaily: 10,
        source: 'discord',
        type: 'post',
        quantity: 100,
        points: 5000
      })
      .set('Accept', 'application/json')
      .expect(201)
      .then((response: any) => {
        assert(response.body.success === true);
        assert(response.body.quest.repeat === true);
        assert(response.body.quest.maxDaily === 10);
        assert(response.body.quest.source === 'discord');
        assert(response.body.quest.type === 'post');
        assert(response.body.quest.quantity === 100);
        assert(response.body.quest.points === 5000);
      });
  });
});
