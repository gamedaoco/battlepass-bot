import * as Joi from 'joi';


export const IdentitySchema = Joi.object({
  discord: Joi.string()
    .alphanum()
    .min(10)
    .max(20)
    .allow(null),
  twitter: Joi.string()
    .alphanum()
    .min(10)
    .max(20)
    .allow(null),
  address: Joi.string()
    .alphanum()
    .length(48)
    .allow(null)
}).or('discord', 'twitter', 'address');


export const QuestSchema = Joi.object({
  battlepass: Joi.string()
    .required()
    .length(66),
  daily: Joi.boolean(),
  source: Joi.string()
    .required()
    .valid('discord', 'twitter', 'gamedao'),
  type: Joi.string()
    .required()
    .valid('post', 'reaction'),
  channelId: Joi.string()
    .min(10)
    .max(50)
    .allow(null),
  quantity: Joi.number()
    .integer()
    .required(),
  points: Joi.number()
    .integer()
    .required(),
  maxDaily: Joi.number()
    .integer()
    .allow(null)
}).with('maxDaily', 'daily');


export const QuestUpdatesSchema = Joi.object({
  battlepass: Joi.string()
    .required()
    .length(66),
  since: Joi.date()
    .iso(),
  address: Joi.string()
    .alphanum()
    .length(48)
});

export const PointUpdatesSchema = Joi.object({
  battlepass: Joi.string()
    .required()
    .length(66),
  since: Joi.date()
    .iso(),
  address: Joi.string()
    .alphanum()
    .length(48)
});

export const AddParticipantSchema = Joi.object({
  battlepass: Joi.string()
    .required()
    .length(66),
  discord: Joi.string()
    .alphanum()
    .min(10)
    .max(20)
    .allow(null),
  twitter: Joi.string()
    .alphanum()
    .min(10)
    .max(20)
    .allow(null),
}).or('discord', 'twitter');
