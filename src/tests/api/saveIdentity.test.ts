import { describe, expect, test, it, beforeEach, beforeAll } from '@jest/globals';
import request = require('supertest');
import assert = require("assert")

import truncate from '../truncate';
import { initDB, sequelize, Identity } from '../../db';
import { app } from '../../api/server';


describe('Save new identity', () => {

  beforeAll(async () => {
    await initDB();
    await sequelize.sync({force: true});
  });

  beforeEach(async () => {
    await truncate();
  });

  let validDiscord = '111111111111111111';

  test('New identity with discord field', async () => {
    const res = await request(app)
      .post('/api/identity')
      .send({discord: validDiscord})
      .set('Accept', 'application/json')
      .expect(201)
      .then((response: any) => {
        assert(response.body.success === true);
        assert(response.body.identity.id === 1);
        assert(response.body.identity.discord === validDiscord);
        assert(!response.body.identity.twitter);
        assert(!response.body.identity.address);
      });
  });

  test('Update identity with existing discord', async () => {
    let existing = await Identity.create({discord: validDiscord});

    const res = await request(app)
      .post('/api/identity')
      .send({discord: validDiscord})
      .set('Accept', 'application/json')
      .expect(200)
      .then((response: any) => {
        assert(response.body.success === true);
        assert(response.body.identity.id === existing.id);
        assert(response.body.identity.discord === validDiscord);
        assert(!response.body.identity.twitter);
        assert(!response.body.identity.address);
      });
  });

  test('Update identity with existing discord and address', async () => {
    let existing = await Identity.create({discord: validDiscord});
    let address = '222222222222222222222222222222222222222222222222';

    const res = await request(app)
      .post('/api/identity')
      .send({discord: validDiscord, address: address})
      .set('Accept', 'application/json')
      .expect(200)
      .then((response: any) => {
        assert(response.body.success === true);
        assert(response.body.identity.id === existing.id);
        assert(response.body.identity.discord === validDiscord);
        assert(response.body.identity.address === address);
        assert(!response.body.identity.twitter);
      });
  });

  describe('Invalid requests', () => {

    test('No fields provided', async () => {
      const res = await request(app)
        .post('/api/identity')
        .send({})
        .set('Accept', 'application/json')
        .expect(400)
        .then((response: any) => {
          assert(response.body.success === false);
          assert(response.body.error);
        });
    });
  });
});
