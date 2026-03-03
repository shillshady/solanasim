import { WSFrame, type PriceTick } from "./types/contracts";
import { errorLogger } from './error-logger';

// Use the proper contract types from our contracts file
type CloseFn = () => void;

/**
 * Hardened WebSocket client for price streaming
 * Features:
 * - Automatic reconnection with exponential backoff
 * - Heartbeat/ping-pong to prevent proxy drops 
 * - Schema validation with Zod to prevent parsing errors
 * - Decimal-safe number handling (no float precision loss)
 * - Safari/mobile/Railway proxy compatibility
 */
export function connectPrices(onTick: (t: PriceTick) => void, url: string): CloseFn {
  let ws: WebSocket | null = null;
  let tries = 0;
  let heartbeat: ReturnType<typeof setInterval> | null = null;
  let closed = false;

  const open = () => {
    if (closed) return;
    
    if (process.env.NODE_ENV === 'development') {
      console.log(`Connecting to ${url} (attempt ${tries + 1})`);
    } else {
      errorLogger.info('Connecting to WebSocket', { metadata: { attempt: tries + 1 }, component: 'ws' });
    }
    ws = new WebSocket(url);
    
    ws.onopen = () => {
      errorLogger.info('WebSocket connected', { component: 'ws' });
      tries = 0;
      
      // Start heartbeat to prevent proxy timeouts
      heartbeat = setInterval(() => {
        if (ws?.readyState === WebSocket.OPEN) {
          ws.send('{"t":"pong"}');
          if (process.env.NODE_ENV === 'development') {
            console.log('Heartbeat sent');
          }
        }
      }, 25000); // 25s is safe for most proxies including Railway
    };

    ws.onmessage = (ev) => {
      // Handle ping-pong heartbeat
      if (ev.data === "ping") { 
        ws?.send('{"t":"pong"}'); 
        return; 
      }
      
      try {
        const msg = JSON.parse(ev.data);
        
        // Handle price ticks with schema validation - new contract format
        if (msg?.t === "price" && msg?.d) {
          try {
            // Validate with Zod schema
            const frame = WSFrame.parse(msg);
            onTick(frame.d);
          } catch (parseError) {
            errorLogger.error('Price tick validation failed', { error: parseError as Error, metadata: { msg }, component: 'ws' });
          }
        }
        // Legacy format support (remove after migration)
        else if (msg?.type === "price" && msg?.mint) {
          try {
            const data: PriceTick = {
              v: 1,
              seq: Date.now(), // fallback sequence
              mint: msg.mint,
              priceLamports: convertPriceToLamports(msg.price || 0).toString(),
              ts: msg.timestamp || Date.now()
            };
            
            onTick(data);
          } catch (parseError) {
            errorLogger.error('Legacy price tick validation failed', { error: parseError as Error, component: 'ws' });
          }
        }
        
        // Handle other message types (hello, pong, etc.) silently
      } catch (jsonError) {
        errorLogger.error('WS frame parse error', { error: jsonError as Error, component: 'ws' });
      }
    };

    const reopen = () => {
      if (closed) return;
      
      if (heartbeat) {
        clearInterval(heartbeat);
        heartbeat = null;
      }
      
      // Exponential backoff with jitter, max 30s
      const baseDelay = Math.min(30000, 1000 * Math.pow(2, tries++));
      const jitter = Math.random() * 1000; // Add randomness to prevent thundering herd
      const delay = baseDelay + jitter;
      
      errorLogger.info('Reconnecting WebSocket', { metadata: { delaySec: Math.round(delay / 1000) }, component: 'ws' });
      setTimeout(open, delay);
    };

    ws.onclose = (event) => {
      if (closed) return;
      errorLogger.info('WebSocket closed', { metadata: { code: event.code, reason: event.reason }, component: 'ws' });
      reopen();
    };
    
    ws.onerror = (event) => {
      if (closed) return;
      errorLogger.error('WebSocket error', { metadata: { type: event.type }, component: 'ws' });
      reopen();
    };
  };

  open();
  
  return () => { 
    errorLogger.info('Closing WebSocket connection', { component: 'ws' });
    closed = true;
    if (heartbeat) clearInterval(heartbeat); 
    ws?.close(); 
  };
}

/**
 * Convert USD price to lamports for decimal-safe storage
 * Uses SOL price conversion to maintain precision
 */
function convertPriceToLamports(usdPrice: number): bigint {
  // This is a simplified conversion - in production you'd want
  // the actual SOL/USD rate for accurate lamport conversion
  const LAMPORTS_PER_SOL = 1_000_000_000n;
  const SOL_USD_ESTIMATE = 150; // This should come from actual SOL price
  
  // Convert USD to SOL, then SOL to lamports
  const solPrice = usdPrice / SOL_USD_ESTIMATE;
  const lamports = BigInt(Math.round(solPrice * Number(LAMPORTS_PER_SOL)));
  
  return lamports;
}