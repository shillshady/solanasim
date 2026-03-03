import type * as Backend from '../types/backend';
import { API, getAuthHeaders } from './client';

export async function claimRewards(request: Backend.RewardsClaimRequest): Promise<Backend.RewardsClaimResponse> {
  const response = await fetch(`${API}/api/rewards/claim`, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify(request),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: 'Failed to claim rewards' }));
    throw new Error(error.message || `HTTP ${response.status}`);
  }

  return response.json();
}

export async function getUserRewardClaims(userId: string): Promise<Backend.RewardClaim[]> {
  const response = await fetch(`${API}/api/rewards/claims/${encodeURIComponent(userId)}`, {
    method: 'GET',
    headers: getAuthHeaders(),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: 'Failed to fetch reward claims' }));
    throw new Error(error.message || `HTTP ${response.status}`);
  }

  const data = await response.json();
  return data.claims;
}

export async function getRewardStats(): Promise<Backend.RewardStats> {
  const response = await fetch(`${API}/api/rewards/stats`, {
    method: 'GET',
    headers: { 'Content-Type': 'application/json' },
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: 'Failed to fetch reward stats' }));
    throw new Error(error.message || `HTTP ${response.status}`);
  }

  return response.json();
}
