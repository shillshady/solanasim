"use client"

import { useState, useCallback } from 'react'
import Image from 'next/image'
import { cn } from '@/lib/utils'
import { errorLogger } from '@/lib/error-logger'

const IPFS_GATEWAYS = [
  'https://cloudflare-ipfs.com/ipfs/',
  'https://gateway.pinata.cloud/ipfs/',
  'https://ipfs.io/ipfs/',
]

interface TokenImageProps {
  src?: string | null
  alt: string
  className?: string
  width?: number
  height?: number
  size?: number
  fallback?: string
}

export function TokenImage({
  src,
  alt,
  className,
  width,
  height,
  size = 32,
  fallback = "/placeholder-token.svg"
}: TokenImageProps) {
  const [hasError, setHasError] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [ipfsGatewayIndex, setIpfsGatewayIndex] = useState(0)

  const finalWidth = width || size
  const finalHeight = height || size

  // Extract IPFS hash if it's an IPFS URL
  const ipfsHash = src?.startsWith('ipfs://') ? src.replace('ipfs://', '') : null

  // Process image source to ensure it loads properly
  let processedSrc = src
  if (src) {
    if (src.includes('dd.dexscreener.com') && !src.startsWith('http')) {
      processedSrc = `https://${src}`
    }

    if (src.startsWith('//')) {
      processedSrc = `https:${src}`
    }

    // Handle IPFS URLs with gateway rotation
    if (ipfsHash) {
      processedSrc = `${IPFS_GATEWAYS[ipfsGatewayIndex]}${ipfsHash}`
    }

    if (src.startsWith('ar://')) {
      processedSrc = `https://arweave.net/${src.replace('ar://', '')}`
    }
  }

  const imageSrc = (hasError || !processedSrc) ? fallback : processedSrc

  const handleError = useCallback(() => {
    // If IPFS, try next gateway before giving up
    if (ipfsHash && ipfsGatewayIndex < IPFS_GATEWAYS.length - 1) {
      setIpfsGatewayIndex(prev => prev + 1)
      return
    }
    errorLogger.warn(`Failed to load token image: ${src}`, { component: 'TokenImage' });
    setHasError(true);
    setIsLoading(false);
  }, [src, ipfsHash, ipfsGatewayIndex])

  return (
    <div className={cn("relative overflow-hidden rounded-full", className)} style={{ width: finalWidth, height: finalHeight }}>
      {isLoading && !hasError && src && (
        <div className="absolute inset-0 bg-muted animate-pulse rounded-full" />
      )}
      <Image
        src={imageSrc}
        alt={alt}
        width={finalWidth}
        height={finalHeight}
        className="object-cover rounded-full"
        onError={handleError}
        onLoad={() => setIsLoading(false)}
        priority={false}
        unoptimized={true}
        referrerPolicy="no-referrer"
      />
    </div>
  )
}