import type * as Backend from '../types/backend';
import { API } from './client';

export async function getPortfolio(userId: string): Promise<Backend.PortfolioResponse> {
  const response = await fetch(`${API}/api/portfolio?userId=${encodeURIComponent(userId)}`, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-cache, no-store, must-revalidate',
      'Pragma': 'no-cache'
    },
    cache: 'no-store'
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: 'Failed to fetch portfolio' }));
    throw new Error(error.message || `HTTP ${response.status}`);
  }

  return response.json();
}

export async function getPortfolioRealtime(userId: string): Promise<Backend.PortfolioResponse> {
  const response = await fetch(`${API}/api/portfolio/realtime?userId=${encodeURIComponent(userId)}`, {
    method: 'GET',
    headers: { 'Content-Type': 'application/json' },
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: 'Failed to fetch real-time portfolio' }));
    throw new Error(error.message || `HTTP ${response.status}`);
  }

  return response.json();
}

export async function getPortfolioStats(userId: string): Promise<Backend.TradingStats> {
  const response = await fetch(`${API}/api/portfolio/stats?userId=${encodeURIComponent(userId)}`, {
    method: 'GET',
    headers: { 'Content-Type': 'application/json' },
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: 'Failed to fetch portfolio stats' }));
    throw new Error(error.message || `HTTP ${response.status}`);
  }

  return response.json();
}

export async function getPortfolioPerformance(userId: string, days: number = 30): Promise<Backend.PortfolioPerformanceResponse> {
  const response = await fetch(`${API}/api/portfolio/performance?userId=${encodeURIComponent(userId)}&days=${days}`, {
    method: 'GET',
    headers: { 'Content-Type': 'application/json' },
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: 'Failed to fetch portfolio performance' }));
    throw new Error(error.message || `HTTP ${response.status}`);
  }

  return response.json();
}
