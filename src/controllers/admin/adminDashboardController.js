import { sendOk } from '../../utils/apiResponse.js';
import * as dash from '../../services/adminDashboardService.js';

export async function dashboardStats(_req, res, next) {
  try {
    return sendOk(res, await dash.getDashboardStats());
  } catch (e) {
    next(e);
  }
}

export async function bookingsChart(req, res, next) {
  try {
    const days = Math.min(30, Math.max(1, parseInt(req.query.days, 10) || 7));
    return sendOk(res, await dash.getBookingsPerDay(days));
  } catch (e) {
    next(e);
  }
}

export async function searchAnalytics(_req, res, next) {
  try {
    return sendOk(res, await dash.getSearchAnalytics());
  } catch (e) {
    next(e);
  }
}

export async function recentActivity(req, res, next) {
  try {
    const limit = Math.min(50, parseInt(req.query.limit, 10) || 15);
    return sendOk(res, await dash.getRecentActivity(limit));
  } catch (e) {
    next(e);
  }
}

export async function heatmap(_req, res, next) {
  try {
    return sendOk(res, await dash.getHeatmapData());
  } catch (e) {
    next(e);
  }
}
