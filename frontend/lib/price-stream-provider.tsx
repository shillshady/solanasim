"use client"

import { createContext, useContext, useState, useEffect, ReactNode, useCallback, useRef } from 'react'
import { env } from './env'
import { errorLogger } from './error-logger'
import { SOL_MINT } from './constants'

export enum ConnectionState {
  Disconnected = 'DISCONNECTED',
  Connecting = 'CONNECTING', 
  Connected = 'CONNECTED',
  Reconnecting = 'RECONNECTING',
  Failed = 'FAILED'
}

interface PriceStreamContextType {
  connected: boolean
  connecting: boolean
  connectionState: ConnectionState
  error: string | null
  subscribe: (tokenAddress: string) => void
  unsubscribe: (tokenAddress: string) => void
  subscribeMany: (tokenAddresses: string[]) => void
  unsubscribeMany: (tokenAddresses: string[]) => void
  prices: Map<string, { price: number; change24h: number; timestamp: number }>
  reconnect: () => void
  disconnect: () => void
}

const PriceStreamContext = createContext<PriceStreamContextType | undefined>(undefined)

interface PriceStreamProviderProps {
  children: React.ReactNode
}

// WebSocket close code descriptions for better debugging
const getCloseCodeDescription = (code: number): string => {
  const codes: Record<number, string> = {
    1000: 'Normal Closure',
    1001: 'Going Away',
    1002: 'Protocol Error',
    1003: 'Unsupported Data',
    1005: 'No Status Received',
    1006: 'Abnormal Closure',
    1007: 'Invalid Frame Payload Data',
    1008: 'Policy Violation',
    1009: 'Message Too Big',
    1010: 'Mandatory Extension',
    1011: 'Internal Server Error',
    1012: 'Service Restart',
    1013: 'Try Again Later',
    1014: 'Bad Gateway',
    1015: 'TLS Handshake'
  }
  return codes[code] || `Unknown Code (${code})`
}

// Hook for managing WebSocket price stream with enhanced connection reliability
function usePriceStream(options: {
  enabled: boolean
  autoReconnect: boolean
  maxReconnectAttempts: number
}): PriceStreamContextType {
  const [connected, setConnected] = useState(false)
  const [connecting, setConnecting] = useState(false)
  const [connectionState, setConnectionState] = useState<ConnectionState>(ConnectionState.Disconnected)
  const [error, setError] = useState<string | null>(null)
  const [prices, setPrices] = useState(new Map<string, { price: number; change24h: number; timestamp: number }>())
  
  const wsRef = useRef<WebSocket | null>(null)
  const subscriptionsRef = useRef<Set<string>>(new Set())
  const reconnectAttemptsRef = useRef(0)
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const isManuallyClosedRef = useRef(false)
  const lastConnectAttemptRef = useRef<number>(0)
  const connectionTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const consecutiveFailuresRef = useRef(0)
  const connectionStartTimeRef = useRef<number>(0)
  const heartbeatIntervalRef = useRef<NodeJS.Timeout | null>(null)
  
  // Enhanced connection settings
  const MIN_RECONNECT_DELAY = 2000 // 2 seconds
  const MAX_RECONNECT_DELAY = 30000 // 30 seconds
  const CONNECTION_TIMEOUT = 15000 // 15 seconds for better Railway compatibility
  const RATE_LIMIT_DELAY = 3000 // 3 seconds between attempts
  const MAX_CONSECUTIVE_FAILURES = 5 // Allow more attempts before giving up
  const IMMEDIATE_FAILURE_THRESHOLD = 3000 // Connection lasting less than 3s is immediate failure
  const HEARTBEAT_INTERVAL = 25000 // 25 seconds heartbeat
  
  const cleanup = useCallback(() => {
    errorLogger.info('Cleaning up WebSocket connection', { component: 'PriceStream' })
    
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current)
      reconnectTimeoutRef.current = null
    }
    
    if (connectionTimeoutRef.current) {
      clearTimeout(connectionTimeoutRef.current)
      connectionTimeoutRef.current = null
    }
    
    if (heartbeatIntervalRef.current) {
      clearInterval(heartbeatIntervalRef.current)
      heartbeatIntervalRef.current = null
    }
    
    if (wsRef.current) {
      isManuallyClosedRef.current = true
      
      // Remove event listeners to prevent callbacks during cleanup
      wsRef.current.onopen = null
      wsRef.current.onclose = null
      wsRef.current.onerror = null
      wsRef.current.onmessage = null
      
      if (wsRef.current.readyState === WebSocket.OPEN || 
          wsRef.current.readyState === WebSocket.CONNECTING) {
        wsRef.current.close(1000, 'Client cleanup')
      }
      wsRef.current = null
    }
  }, [])
  
  const updateConnectionState = useCallback((state: ConnectionState) => {
    errorLogger.debug(`Connection state: ${connectionState} -> ${state}`, { component: 'PriceStream' })
    setConnectionState(state)
    setConnected(state === ConnectionState.Connected)
    setConnecting(state === ConnectionState.Connecting || state === ConnectionState.Reconnecting)
  }, [connectionState])
  
  const startHeartbeat = useCallback(() => {
    if (heartbeatIntervalRef.current) {
      clearInterval(heartbeatIntervalRef.current)
    }
    
    heartbeatIntervalRef.current = setInterval(() => {
      if (wsRef.current?.readyState === WebSocket.OPEN) {
        try {
          // Send ping message to keep connection alive
          wsRef.current.send(JSON.stringify({ type: 'ping', timestamp: Date.now() }))
        } catch (err) {
          errorLogger.error('Failed to send heartbeat', { error: err as Error, component: 'PriceStream' })
        }
      }
    }, HEARTBEAT_INTERVAL)
  }, [])
  
  const connect = useCallback(async () => {
    errorLogger.debug('Connect function called', {
      metadata: { enabled: options.enabled, connectionState, attempt: reconnectAttemptsRef.current },
      component: 'PriceStream'
    })
    
    // Rate limiting - prevent rapid connection attempts
    const now = Date.now()
    if (now - lastConnectAttemptRef.current < RATE_LIMIT_DELAY) {
      errorLogger.debug('Connection attempt rate limited', { component: 'PriceStream' })
      return
    }
    lastConnectAttemptRef.current = now
    
    // Prevent concurrent connections or if manually disabled
    if (!options.enabled || 
        connectionState === ConnectionState.Connecting || 
        connectionState === ConnectionState.Connected || 
        isManuallyClosedRef.current) {
      return
    }
    
    // Check if we've exceeded reconnection attempts
    if (reconnectAttemptsRef.current >= options.maxReconnectAttempts) {
      setError(`Max reconnection attempts (${options.maxReconnectAttempts}) exceeded`)
      updateConnectionState(ConnectionState.Failed)
      return
    }
    
    // Check for too many consecutive immediate failures
    if (consecutiveFailuresRef.current >= MAX_CONSECUTIVE_FAILURES) {
      setError(`WebSocket server appears to be rejecting connections (${MAX_CONSECUTIVE_FAILURES} consecutive immediate failures)`)
      updateConnectionState(ConnectionState.Failed)
      errorLogger.error('Stopping reconnection attempts due to consecutive immediate failures', { component: 'PriceStream' })
      return
    }
    
    try {
      updateConnectionState(reconnectAttemptsRef.current > 0 ? ConnectionState.Reconnecting : ConnectionState.Connecting)
      setError(null)
      
      const attemptNum = reconnectAttemptsRef.current + 1
      errorLogger.info(`${attemptNum > 1 ? 'Reconnecting' : 'Connecting'} to WebSocket (attempt ${attemptNum}/${options.maxReconnectAttempts})`, { component: 'PriceStream' })
      if (process.env.NODE_ENV === 'development') {
        console.log(`Target URL: ${env.NEXT_PUBLIC_WS_URL}`)
      }
      
      connectionStartTimeRef.current = Date.now()
      
      // Create WebSocket with better error handling and browser compatibility
      let ws: WebSocket
      
      try {
        // Add small delay for Chrome compatibility
        if (typeof window !== 'undefined' && window.navigator?.userAgent?.includes('Chrome')) {
          await new Promise(resolve => setTimeout(resolve, 100))
        }
        
        // Derive WS URL — ensure it points to /ws/prices
        const baseWsUrl = env.NEXT_PUBLIC_WS_URL.replace(/\/(ws\/)?prices?\/?$/, '')
        const wsUrl = `${baseWsUrl}/ws/prices`

        // Create WebSocket with explicit protocols for better proxy/CDN compatibility
        ws = new WebSocket(wsUrl, ['websocket'])
        wsRef.current = ws
        
        errorLogger.debug(`WebSocket created, readyState: ${ws.readyState}`, { component: 'PriceStream' })
        
        // Small delay before setting up event listeners
        await new Promise(resolve => setTimeout(resolve, 50))
      } catch (createError) {
        errorLogger.error('Failed to create WebSocket', { error: createError as Error, component: 'PriceStream' })
        throw createError
      }
      
      // Set connection timeout with generous time for Railway
      connectionTimeoutRef.current = setTimeout(() => {
        if (ws.readyState === WebSocket.CONNECTING) {
          errorLogger.error('WebSocket connection timeout after 15 seconds', { component: 'PriceStream' })
          ws.close()
          setError('Connection timeout - server may be unreachable')
          updateConnectionState(ConnectionState.Disconnected)
          consecutiveFailuresRef.current++
          
          if (options.autoReconnect && !isManuallyClosedRef.current) {
            scheduleReconnect()
          }
        }
      }, CONNECTION_TIMEOUT)
      
      ws.onopen = () => {
        if (connectionTimeoutRef.current) {
          clearTimeout(connectionTimeoutRef.current)
          connectionTimeoutRef.current = null
        }

        updateConnectionState(ConnectionState.Connected)
        setError(null)
        reconnectAttemptsRef.current = 0
        consecutiveFailuresRef.current = 0
        isManuallyClosedRef.current = false

        // Start heartbeat to maintain connection
        startHeartbeat()

        // Subscribe to SOL first for base price calculations
        try {
          ws.send(JSON.stringify({ type: 'subscribe', mint: SOL_MINT }))
        } catch (err) {
          errorLogger.error('Failed to subscribe to SOL', { error: err as Error, component: 'PriceStream' })
        }

        // Resubscribe to all tokens with delay to avoid overwhelming the server
        setTimeout(() => {
          const subscriptions = Array.from(subscriptionsRef.current)
          subscriptions.forEach((address, index) => {
            setTimeout(() => {
              try {
                if (ws.readyState === WebSocket.OPEN) {
                  ws.send(JSON.stringify({ type: 'subscribe', mint: address }))
                }
              } catch (err) {
                errorLogger.error('Failed to resubscribe', { error: err as Error, component: 'PriceStream' })
              }
            }, index * 100) // Stagger subscriptions by 100ms each
          })
        }, 200)
      }
      
      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data)

          if (data.type === 'price' && data.mint) {
            setPrices(prev => {
              const next = new Map(prev)
              next.set(data.mint, {
                price: data.price || 0,
                change24h: data.change24h || 0,
                timestamp: Date.now()
              })
              return next
            })
          }
          // Silently handle pong and hello messages
        } catch (err) {
          errorLogger.error('Failed to parse WebSocket message', { error: err as Error, component: 'PriceStream' })
        }
      }
      
      ws.onerror = (event) => {
        errorLogger.error('WebSocket error event', { component: 'PriceStream' })
        
        if (connectionTimeoutRef.current) {
          clearTimeout(connectionTimeoutRef.current)
          connectionTimeoutRef.current = null
        }
        
        setError('WebSocket connection error - check network connectivity')
        updateConnectionState(ConnectionState.Disconnected)
      }
      
      ws.onclose = (event) => {
        errorLogger.info(`WebSocket closed: ${event.wasClean ? 'clean' : 'unclean'} (${event.code}) - ${getCloseCodeDescription(event.code)}`, {
          metadata: { code: event.code, reason: event.reason, wasClean: event.wasClean },
          component: 'PriceStream'
        })
        
        if (connectionTimeoutRef.current) {
          clearTimeout(connectionTimeoutRef.current)
          connectionTimeoutRef.current = null
        }
        
        if (heartbeatIntervalRef.current) {
          clearInterval(heartbeatIntervalRef.current)
          heartbeatIntervalRef.current = null
        }
        
        const connectionDuration = Date.now() - connectionStartTimeRef.current
        errorLogger.debug(`Connection duration: ${connectionDuration}ms`, { component: 'PriceStream' })
        
        // Enhanced logging for immediate failures
        if (connectionDuration < IMMEDIATE_FAILURE_THRESHOLD) {
          errorLogger.error(`Immediate failure detected (${connectionDuration}ms < ${IMMEDIATE_FAILURE_THRESHOLD}ms) - suggests server rejection or proxy/CDN issues`, { component: 'PriceStream' })
          consecutiveFailuresRef.current++
        } else {
          consecutiveFailuresRef.current = 0
        }
        
        updateConnectionState(ConnectionState.Disconnected)
        wsRef.current = null
        
        // Handle reconnection based on close reason
        if (!isManuallyClosedRef.current && options.autoReconnect) {
          // Normal closures - don't reconnect
          if (event.code === 1000 || event.code === 1001) {
            errorLogger.debug('Not reconnecting due to normal closure', { component: 'PriceStream' })
            return
          }
          
          // Server errors that might be temporary
          if (event.code === 1011 || event.code === 1012 || event.code === 1013) {
            errorLogger.info('Server error - will attempt reconnection', { component: 'PriceStream' })
          }
          
          // Stop reconnecting if too many consecutive immediate failures
          if (consecutiveFailuresRef.current >= MAX_CONSECUTIVE_FAILURES) {
            setError(`Server appears to be rejecting connections (${MAX_CONSECUTIVE_FAILURES} consecutive immediate failures). Please check your network or try again later.`)
            updateConnectionState(ConnectionState.Failed)
            errorLogger.error('Stopping reconnection attempts - server rejection pattern detected', { component: 'PriceStream' })
            return
          }
          
          if (reconnectAttemptsRef.current < options.maxReconnectAttempts) {
            scheduleReconnect()
          } else {
            setError(`Connection failed after ${options.maxReconnectAttempts} attempts`)
            updateConnectionState(ConnectionState.Failed)
          }
        }
      }
    } catch (err) {
      errorLogger.error('Failed to create WebSocket', { error: err as Error, component: 'PriceStream' })
      setError(err instanceof Error ? err.message : 'Failed to create WebSocket connection')
      updateConnectionState(ConnectionState.Disconnected)
      consecutiveFailuresRef.current++
      
      if (options.autoReconnect && !isManuallyClosedRef.current) {
        scheduleReconnect()
      }
    }
  }, [options.enabled, options.autoReconnect, options.maxReconnectAttempts, connectionState, updateConnectionState, startHeartbeat])
  
  const scheduleReconnect = useCallback(() => {
    reconnectAttemptsRef.current++
    
    // Enhanced exponential backoff with jitter
    const baseDelay = Math.min(MIN_RECONNECT_DELAY * Math.pow(1.5, reconnectAttemptsRef.current - 1), MAX_RECONNECT_DELAY)
    const jitter = Math.random() * 0.5 * baseDelay // Add up to 50% jitter
    const delay = Math.floor(baseDelay + jitter)
    
    errorLogger.info(`Scheduling reconnect in ${(delay / 1000).toFixed(1)}s (attempt ${reconnectAttemptsRef.current}/${options.maxReconnectAttempts})`, { component: 'PriceStream' })
    
    reconnectTimeoutRef.current = setTimeout(() => {
      reconnectTimeoutRef.current = null
      if (!isManuallyClosedRef.current) {
        connect()
      }
    }, delay)
  }, [connect, options.maxReconnectAttempts])
  
  const subscribe = useCallback((tokenAddress: string) => {
    if (!tokenAddress) return

    subscriptionsRef.current.add(tokenAddress)

    if (wsRef.current?.readyState === WebSocket.OPEN) {
      try {
        wsRef.current.send(JSON.stringify({ type: 'subscribe', mint: tokenAddress }))
      } catch (err) {
        errorLogger.error('Failed to send subscription', { error: err as Error, component: 'PriceStream' })
      }
    }
  }, [])
  
  const unsubscribe = useCallback((tokenAddress: string) => {
    if (!tokenAddress) return

    subscriptionsRef.current.delete(tokenAddress)

    if (wsRef.current?.readyState === WebSocket.OPEN) {
      try {
        wsRef.current.send(JSON.stringify({ type: 'unsubscribe', mint: tokenAddress }))
      } catch (err) {
        errorLogger.error('Failed to send unsubscription', { error: err as Error, component: 'PriceStream' })
      }
    }
  }, [])
  
  const subscribeMany = useCallback((tokenAddresses: string[]) => {
    tokenAddresses.filter(Boolean).forEach(subscribe)
  }, [subscribe])
  
  const unsubscribeMany = useCallback((tokenAddresses: string[]) => {
    tokenAddresses.filter(Boolean).forEach(unsubscribe)
  }, [unsubscribe])
  
  const reconnect = useCallback(() => {
    errorLogger.info('Manual reconnect requested', { component: 'PriceStream' })
    cleanup()
    reconnectAttemptsRef.current = 0
    consecutiveFailuresRef.current = 0
    isManuallyClosedRef.current = false
    setError(null)
    updateConnectionState(ConnectionState.Disconnected)
    
    // Delay to ensure cleanup is complete
    setTimeout(() => {
      if (!isManuallyClosedRef.current) {
        connect()
      }
    }, 200)
  }, [connect, cleanup, updateConnectionState])
  
  const disconnect = useCallback(() => {
    errorLogger.info('Manual disconnect requested', { component: 'PriceStream' })
    isManuallyClosedRef.current = true
    cleanup()
    updateConnectionState(ConnectionState.Disconnected)
    setError(null)
  }, [cleanup, updateConnectionState])
  
  // Enhanced effect with better mounting/unmounting handling
  useEffect(() => {
    if (options.enabled && !isManuallyClosedRef.current) {
      errorLogger.info('Price stream enabled, initiating connection', { component: 'PriceStream' })
      
      // Delay to prevent rapid mounting/unmounting in React Strict Mode
      const timer = setTimeout(() => {
        if (!isManuallyClosedRef.current && options.enabled) {
          connect()
        }
      }, 200)
      
      return () => {
        clearTimeout(timer)
        cleanup()
      }
    } else {
      errorLogger.debug('Price stream disabled or manually closed', { component: 'PriceStream' })
    }
    
    return () => {
      cleanup()
    }
  }, [options.enabled, connect, cleanup])
  
  // Cleanup on unmount
  useEffect(() => {
    return () => {
      errorLogger.debug('Price stream provider unmounting', { component: 'PriceStream' })
      cleanup()
    }
  }, [cleanup])
  
  return {
    connected,
    connecting,
    connectionState,
    error,
    subscribe,
    unsubscribe,
    subscribeMany,
    unsubscribeMany,
    prices,
    reconnect,
    disconnect
  }
}

export function PriceStreamProvider({ children }: PriceStreamProviderProps) {
  const priceStream = usePriceStream({
    enabled: true,
    autoReconnect: true,
    maxReconnectAttempts: 10
  })

  return (
    <PriceStreamContext.Provider value={priceStream}>
      {children}
    </PriceStreamContext.Provider>
  )
}

export function usePriceStreamContext(): PriceStreamContextType {
  const context = useContext(PriceStreamContext)
  if (context === undefined) {
    throw new Error('usePriceStreamContext must be used within a PriceStreamProvider')
  }
  return context
}