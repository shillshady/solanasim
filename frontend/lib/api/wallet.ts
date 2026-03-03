import type * as Backend from '../types/backend';
import { API } from './client';

export async function getWalletBalance(userId: string): Promise<Backend.WalletBalance> {
  const response = await fetch(`${API}/api/wallet/balance/${encodeURIComponent(userId)}`, {
    method: 'GET',
    headers: { 'Content-Type': 'application/json' },
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: 'Failed to fetch balance' }));
    throw new Error(error.message || `HTTP ${response.status}`);
  }

  return response.json();
}

export async function getWalletTransactions(
  userId: string,
  limit: number = 50,
  offset: number = 0
): Promise<{ transactions: Backend.WalletTransaction[] }> {
  const response = await fetch(
    `${API}/api/wallet/transactions/${encodeURIComponent(userId)}?limit=${limit}&offset=${offset}`,
    {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
    }
  );

  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: 'Failed to fetch transactions' }));
    throw new Error(error.message || `HTTP ${response.status}`);
  }

  return response.json();
}

export async function getWalletStats(userId: string): Promise<Backend.WalletStats> {
  const response = await fetch(`${API}/api/wallet/stats/${encodeURIComponent(userId)}`, {
    method: 'GET',
    headers: { 'Content-Type': 'application/json' },
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: 'Failed to fetch wallet stats' }));
    throw new Error(error.message || `HTTP ${response.status}`);
  }

  return response.json();
}
