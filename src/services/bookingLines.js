import { randomInt } from 'crypto';
import { BookingLineItem } from '../models/index.js';
import { toNum } from '../serializers/formatters.js';

export function normalizeSelectedItems(raw) {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((item) => {
      const qty = Math.max(1, parseInt(String(item.quantity ?? 1), 10) || 1);
      const price = Math.round(Number(item.price ?? item.unitPrice ?? 0));
      const title = String(item.title || item.serviceName || '').trim();
      if (!title || price < 0) return null;
      return {
        serviceItemId: item.serviceItemId ? String(item.serviceItemId) : null,
        title,
        unitPrice: price,
        quantity: qty,
        lineTotal: price * qty,
      };
    })
    .filter(Boolean);
}

export function sumLineItems(items) {
  return items.reduce((sum, i) => sum + i.lineTotal, 0);
}

export async function createBookingLineItems(bookingId, items) {
  const created = [];
  for (const item of items) {
    const row = await BookingLineItem.create({
      id: `bli_${Date.now()}_${randomInt(1000, 9999)}`,
      bookingId,
      serviceItemId: item.serviceItemId,
      title: item.title,
      unitPrice: item.unitPrice,
      quantity: item.quantity,
      lineTotal: item.lineTotal,
    });
    created.push(row);
  }
  return created;
}

export async function loadLineItemsForBookings(bookingIds) {
  if (!bookingIds.length) return new Map();
  const rows = await BookingLineItem.findAll({
    where: { bookingId: bookingIds },
    order: [['createdAt', 'ASC']],
  });
  const map = new Map();
  for (const row of rows) {
    const list = map.get(row.bookingId) || [];
    list.push({
      id: row.id,
      serviceItemId: row.serviceItemId,
      title: row.title,
      unitPrice: toNum(row.unitPrice),
      quantity: row.quantity,
      lineTotal: toNum(row.lineTotal),
    });
    map.set(row.bookingId, list);
  }
  return map;
}

export function mapLineItemRow(row) {
  return {
    id: row.id,
    serviceItemId: row.serviceItemId,
    title: row.title,
    unitPrice: toNum(row.unitPrice),
    quantity: row.quantity,
    lineTotal: toNum(row.lineTotal),
  };
}
