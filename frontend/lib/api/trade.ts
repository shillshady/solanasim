import type * as Backend from '../types/backend';
import { API, getAuthHeaders } from './client';

export async function trade(request: Backend.TradeRequest): Promise<Backend.TradeResponse> {
  const response = await fetch(`${API}/api/trade`, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify(request),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: 'Trade failed' }));
    throw new Error(error.message || `HTTP ${response.status}`);
  }

  return response.json();
}
