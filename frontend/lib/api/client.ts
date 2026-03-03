import type * as Backend from '../types/backend';

export const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

export function getAuthHeaders(): HeadersInit {
  const token = typeof window !== 'undefined' ? localStorage.getItem('accessToken') : null;
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  return headers;
}

export async function apiCall<T>(
  endpoint: string,
  options?: RequestInit
): Promise<T> {
  const response = await fetch(`${API}${endpoint}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options?.headers,
    },
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: 'API call failed' }));
    throw new Error(error.error || error.message || `HTTP ${response.status}`);
  }

  return response.json();
}

interface ApiRequestConfig {
  params?: Record<string, any>;
  headers?: HeadersInit;
}

export interface ApiResponse<T> {
  data: T;
  status: number;
}

export const api = {
  async get<T>(endpoint: string, config?: ApiRequestConfig): Promise<ApiResponse<T>> {
    const params = config?.params
      ? '?' + new URLSearchParams(config.params).toString()
      : '';

    const response = await fetch(`${API}${endpoint}${params}`, {
      method: 'GET',
      headers: {
        ...getAuthHeaders(),
        ...config?.headers,
      },
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ message: 'Request failed' }));
      throw new Error(error.error || error.message || `HTTP ${response.status}`);
    }

    const data = await response.json();
    return { data, status: response.status };
  },

  async post<T>(endpoint: string, body?: any, config?: ApiRequestConfig): Promise<ApiResponse<T>> {
    const response = await fetch(`${API}${endpoint}`, {
      method: 'POST',
      headers: {
        ...getAuthHeaders(),
        ...config?.headers,
      },
      body: body ? JSON.stringify(body) : undefined,
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ message: 'Request failed' }));
      throw new Error(error.error || error.message || `HTTP ${response.status}`);
    }

    const data = await response.json();
    return { data, status: response.status };
  },

  async patch<T>(endpoint: string, body?: any, config?: ApiRequestConfig): Promise<ApiResponse<T>> {
    const response = await fetch(`${API}${endpoint}`, {
      method: 'PATCH',
      headers: {
        ...getAuthHeaders(),
        ...config?.headers,
      },
      body: body ? JSON.stringify(body) : undefined,
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ message: 'Request failed' }));
      throw new Error(error.error || error.message || `HTTP ${response.status}`);
    }

    const data = await response.json();
    return { data, status: response.status };
  },

  async delete<T>(endpoint: string, config?: ApiRequestConfig): Promise<ApiResponse<T>> {
    const response = await fetch(`${API}${endpoint}`, {
      method: 'DELETE',
      headers: {
        ...getAuthHeaders(),
        ...config?.headers,
      },
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ message: 'Request failed' }));
      throw new Error(error.error || error.message || `HTTP ${response.status}`);
    }

    const data = await response.json();
    return { data, status: response.status };
  },
};
