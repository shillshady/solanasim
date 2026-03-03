import type * as Backend from '../types/backend';
import { API } from './client';

export async function getLeaderboard(limit: number = 50): Promise<Backend.LeaderboardEntry[]> {
  const response = await fetch(`${API}/api/leaderboard?limit=${limit}`, {
    method: 'GET',
    headers: { 'Content-Type': 'application/json' },
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: 'Failed to fetch leaderboard' }));
    throw new Error(error.error || error.message || `HTTP ${response.status}`);
  }

  return response.json();
}
