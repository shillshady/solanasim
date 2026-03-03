import { API, getAuthHeaders } from './client';

export async function openPerpPosition(request: {
  userId: string;
  mint: string;
  side: "LONG" | "SHORT";
  leverage: number;
  marginAmount: string;
}): Promise<any> {
  const response = await fetch(`${API}/api/perp/open`, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify(request),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: 'Failed to open perp position' }));
    throw new Error(error.error || error.message || `HTTP ${response.status}`);
  }

  return response.json();
}

export async function closePerpPosition(request: {
  userId: string;
  positionId: string;
}): Promise<any> {
  const response = await fetch(`${API}/api/perp/close`, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify(request),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: 'Failed to close perp position' }));
    throw new Error(error.error || error.message || `HTTP ${response.status}`);
  }

  return response.json();
}

export async function getPerpPositions(userId: string): Promise<any> {
  const response = await fetch(`${API}/api/perp/positions/${encodeURIComponent(userId)}`, {
    method: 'GET',
    headers: getAuthHeaders(),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: 'Failed to fetch perp positions' }));
    throw new Error(error.message || `HTTP ${response.status}`);
  }

  const data = await response.json();
  return data.positions || [];
}

export async function getPerpTradeHistory(userId: string, limit?: number): Promise<any> {
  const url = `${API}/api/perp/history/${encodeURIComponent(userId)}${limit ? `?limit=${limit}` : ''}`;
  const response = await fetch(url, {
    method: 'GET',
    headers: getAuthHeaders(),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: 'Failed to fetch perp history' }));
    throw new Error(error.message || `HTTP ${response.status}`);
  }

  const data = await response.json();
  return data.trades || [];
}

export async function getPerpWhitelist(): Promise<string[]> {
  const response = await fetch(`${API}/api/perp/whitelist`, {
    method: 'GET',
    headers: getAuthHeaders(),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: 'Failed to fetch whitelist' }));
    throw new Error(error.message || `HTTP ${response.status}`);
  }

  const data = await response.json();
  return data.tokens || [];
}
