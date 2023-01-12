import { Router } from 'express';

import { saveIdentityView } from './saveIdentity';
import { saveQuestView } from './saveQuest';
import { getCompletedQuestsView } from './getCompletedQuests';
import { getPointsView } from './getPoints';


export const router = Router();
router.post('/identity', saveIdentityView);
router.post('/quest', saveQuestView);
router.get('/completed-quest', getCompletedQuestsView);
router.get('/points', getPointsView);
