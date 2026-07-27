import { Router } from 'express';
import { requireUserOrPartner } from '../middlewares/auth.js';
import * as c from '../controllers/marketplaceController.js';
import * as chat from '../controllers/marketplaceChatController.js';

const r = Router();

// Public browse (no auth needed to see listings)
r.get('/categories', c.listCategories);
r.get('/listings', c.listListings);
r.get('/listings/:id', c.getListing);

// Buyer/Seller actions — either User or Partner token accepted
r.use(requireUserOrPartner);
r.post('/listings', c.createListing);
r.get('/my-listings', c.listMyListings);
r.post('/listings/:id/report', c.reportListing);
r.post('/chat', chat.startOrGetConversation);
r.post('/chat/:id/messages', chat.sendMessage);
r.post('/chat/:id/share-contact', chat.shareContact);

export default r;
