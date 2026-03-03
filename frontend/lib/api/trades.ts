import type * as Backend from '../types/backend';
import { API } from './client';

export async function getTrades(limit: number = 50, offset: number = 0): Promise<Backend.TradesResponse> {
  const response = await fetch(`${API}/api/trades?limit=${limit}&offset=${offset}`, {
    method: 'GET',
    headers: { 'Content-Type': 'application/json' },
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: 'Failed to fetch trades' }));
    throw new Error(error.error || error.message || `HTTP ${response.status}`);
  }

  return response.json();
}

export async function getUserTrades(userId: string, limit: number = 50, offset: number = 0): Promise<Backend.TradesResponse> {
  const response = await fetch(`${API}/api/trades/user/${encodeURIComponent(userId)}?limit=${limit}&offset=${offset}`, {
    method: 'GET',
    headers: { 'Content-Type': 'application/json' },
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: 'Failed to fetch user trades' }));
    throw new Error(error.error || error.message || `HTTP ${response.status}`);
  }

  return response.json();
}

export async function getTokenTrades(mint: string, limit: number = 50, offset: number = 0): Promise<Backend.TradesResponse> {
  const response = await fetch(`${API}/api/trades/token/${encodeURIComponent(mint)}?limit=${limit}&offset=${offset}`, {
    method: 'GET',
    headers: { 'Content-Type': 'application/json' },
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: 'Failed to fetch token trades' }));
    throw new Error(error.error || error.message || `HTTP ${response.status}`);
  }

  return response.json();
}

export async function getTradeStats(): Promise<Backend.TradeStats> {
  const response = await fetch(`${API}/api/trades/stats`, {
    method: 'GET',
    headers: { 'Content-Type': 'application/json' },
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: 'Failed to fetch trade stats' }));
    throw new Error(error.error || error.message || `HTTP ${response.status}`);
  }

  return response.json();
}
