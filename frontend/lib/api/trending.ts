import type * as Backend from '../types/backend';
import { API } from './client';

export async function getTrendingTokens(): Promise<Backend.TrendingToken[]> {
  const response = await fetch(`${API}/api/trending`, {
    method: 'GET',
    headers: { 'Content-Type': 'application/json' },
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: 'Failed to fetch trending tokens' }));
    throw new Error(error.message || `HTTP ${response.status}`);
  }

  const data = await response.json();
  return data.items;
}

export async function getTrending(sortBy: 'rank' | 'volume24hUSD' | 'liquidity' = 'rank'): Promise<Backend.TrendingToken[]> {
  const response = await fetch(`${API}/api/trending?sortBy=${sortBy}`, {
    method: 'GET',
    headers: { 'Content-Type': 'application/json' },
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: 'Failed to fetch trending tokens' }));
    throw new Error(error.message || `HTTP ${response.status}`);
  }

  const data = await response.json();
  return data.items;
}

export async function getStocks(limit: number = 50): Promise<Backend.TrendingToken[]> {
  const response = await fetch(`${API}/api/stocks?limit=${limit}`, {
    method: 'GET',
    headers: { 'Content-Type': 'application/json' },
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: 'Failed to fetch stocks' }));
    throw new Error(error.message || `HTTP ${response.status}`);
  }

  const data = await response.json();
  return data.items;
}
