import { Router } from 'express';
import { requireUser } from '../middlewares/auth.js';
import * as c from '../controllers/userController.js';
import * as support from '../controllers/userSupportController.js';
import * as emergency from '../controllers/emergencyController.js';

const r = Router();
r.use(requireUser);
r.get('/me', c.getMe);
r.put('/me', c.updateMe);
r.delete('/me', c.deleteMe);
r.post('/emergency', emergency.createEmergencyRequest);
r.get('/support/tickets', support.listMyTickets);
r.post('/support/tickets', support.createTicket);
r.post('/support/chat', support.startOrGetConversation);
r.post('/support/chat/:id/messages', support.sendUserMessage);

export default r;
