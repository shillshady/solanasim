import type * as Backend from '../types/backend';
import { API, getAuthHeaders } from './client';

export async function getPurchaseTiers(): Promise<Backend.PurchaseTiersResponse> {
  const response = await fetch(`${API}/api/purchase/tiers`, {
    method: 'GET',
    headers: { 'Content-Type': 'application/json' },
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: 'Failed to fetch purchase tiers' }));
    throw new Error(error.error || error.message || `HTTP ${response.status}`);
  }

  return response.json();
}

export async function initiatePurchase(
  request: Backend.PurchaseRequest
): Promise<Backend.PurchaseInitiateResponse> {
  const response = await fetch(`${API}/api/purchase/initiate`, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify(request),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: 'Failed to initiate purchase' }));
    throw new Error(error.error || error.message || `HTTP ${response.status}`);
  }

  return response.json();
}

export async function verifyPurchase(
  request: Backend.PurchaseVerifyRequest
): Promise<Backend.PurchaseVerifyResponse> {
  const response = await fetch(`${API}/api/purchase/verify`, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify(request),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: 'Failed to verify purchase' }));
    throw new Error(error.error || error.message || `HTTP ${response.status}`);
  }

  return response.json();
}

export async function getPurchaseHistory(
  userId: string,
  limit: number = 50,
  offset: number = 0
): Promise<{ purchases: Backend.PurchaseHistory[]; total: number }> {
  const response = await fetch(
    `${API}/api/purchase/history/${encodeURIComponent(userId)}?limit=${limit}&offset=${offset}`,
    {
      method: 'GET',
      headers: getAuthHeaders(),
    }
  );

  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: 'Failed to fetch purchase history' }));
    throw new Error(error.error || error.message || `HTTP ${response.status}`);
  }

  return response.json();
}
