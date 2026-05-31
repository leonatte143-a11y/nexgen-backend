import { sendOk } from '../../utils/apiResponse.js';
import * as dash from '../../services/adminDashboardService.js';
import * as dashExt from '../../services/adminDashboardExtendedService.js';

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

export async function partnerPerformance(_req, res, next) {
  try {
    return sendOk(res, await dashExt.getPartnerPerformance());
  } catch (e) {
    next(e);
  }
}

export async function financialBreakdown(_req, res, next) {
  try {
    return sendOk(res, await dashExt.getFinancialBreakdown());
  } catch (e) {
    next(e);
  }
}

export async function financialPipeline(_req, res, next) {
  try {
    return sendOk(res, await dashExt.getFinancialPipeline());
  } catch (e) {
    next(e);
  }
}

export async function userGrowth(req, res, next) {
  try {
    const range = req.query.range || '7d';
    return sendOk(res, await dashExt.getUserGrowth(range));
  } catch (e) {
    next(e);
  }
}

export async function reviewsSentiment(req, res, next) {
  try {
    const limit = Math.min(50, parseInt(req.query.limit, 10) || 10);
    return sendOk(res, await dashExt.getReviewsSentiment(limit));
  } catch (e) {
    next(e);
  }
}

export async function supportChatSummary(_req, res, next) {
  try {
    return sendOk(res, await dashExt.getSupportChatSummary());
  } catch (e) {
    next(e);
  }
}

export async function dashboardAlerts(_req, res, next) {
  try {
    return sendOk(res, await dashExt.getDashboardAlerts());
  } catch (e) {
    next(e);
  }
}
