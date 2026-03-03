import type * as Backend from '../types/backend';
import { API } from './client';

export async function getTokenDetails(mint: string): Promise<Backend.Token> {
  const response = await fetch(`${API}/api/search/token/${encodeURIComponent(mint)}`, {
    method: 'GET',
    headers: { 'Content-Type': 'application/json' },
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: 'Failed to fetch token details' }));
    throw new Error(error.message || `HTTP ${response.status}`);
  }

  const data = await response.json();

  return {
    ...data,
    address: data.mint || data.address,
    imageUrl: data.logoURI || data.imageUrl,
    price: data.price || (data.lastPrice ? parseFloat(data.lastPrice) : 0),
    isNew: data.isNew || false,
    isTrending: data.isTrending || false,
    websites: data.websites || '[]',
    socials: data.socials || '[]',
    website: data.website || null,
    twitter: data.twitter || null,
    telegram: data.telegram || null,
  };
}

export async function searchTokens(query: string, limit: number = 20): Promise<Backend.TokenSearchResult[]> {
  if (!query || query.length < 2) {
    throw new Error('Query must be at least 2 characters');
  }

  const response = await fetch(`${API}/api/search/tokens?q=${encodeURIComponent(query)}&limit=${limit}`, {
    method: 'GET',
    headers: { 'Content-Type': 'application/json' },
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: 'Search failed' }));
    throw new Error(error.message || `HTTP ${response.status}`);
  }

  const data = await response.json();
  return (data.results || []).map((token: any) => ({
    ...token,
    address: token.mint || token.address,
    imageUrl: token.logoURI || token.imageUrl,
    price: token.priceUsd || token.price || 0,
    lastPrice: token.priceUsd?.toString() || token.price?.toString() || null,
  }));
}

export async function getTokenMetadata(mint: string): Promise<{
  symbol: string;
  name: string;
  logoURI?: string;
  priceUsd?: number;
  priceChange24h?: number;
}> {
  const { getTokenLogoFallback } = await import('../token-logos');

  const token = await getTokenDetails(mint);

  const logoURI = token.logoURI || token.imageUrl || getTokenLogoFallback(mint) || undefined;

  return {
    symbol: token.symbol || 'UNKNOWN',
    name: token.name || 'Unknown Token',
    logoURI,
    priceUsd: token.price ?? undefined,
    priceChange24h: token.priceChange24h ? parseFloat(token.priceChange24h) : undefined,
  };
}
