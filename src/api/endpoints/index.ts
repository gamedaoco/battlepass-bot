import { Router } from 'express';

import { saveIdentity } from './saveIdentity';
import { saveQuest } from './saveQuest';
import { getCompletedQuests } from './getCompletedQuests';
import { getPoints } from './getPoints';


export const router = Router();
router.post('/identity', saveIdentity);
router.post('/quest', saveQuest);
router.get('/completed-quest', getCompletedQuests);
router.get('/points', getPoints);
