// Stocks service for tokenized stocks
import { robustFetch } from "../utils/fetch.js";
import redis from "../plugins/redis.js";
import { safeStringify, safeParse } from "../utils/json.js";
import { loggers } from "../utils/logger.js";
const logger = loggers.stocks;

export interface StockToken {
  mint: string;
  symbol: string | null;
  name: string | null;
  logoURI: string | null;
  priceUsd: number;
  priceChange24h: number;
  priceChange5m?: number;
  priceChange1h?: number;
  priceChange6h?: number;
  volume24h: number;
  marketCapUsd: number | null;
  liquidity?: number;
}

// xStocks tokenized stocks with verified Solana mint addresses and CDN image URLs
const XSTOCKS_TOKENS = [
  // Tech Giants
  { symbol: 'NVDAx', name: 'NVIDIA', mint: 'Xsc9qvGR1efVDFGLrVsmkzv3qi45LTBjeUKSPmx9qEh', image: 'https://cdn.prod.website-files.com/655f3efc4be468487052e35a/684961bfb45e3c4d777b9997_Ticker%3DNVDA%2C%20Company%20Name%3DNVIDIA%20Corp%2C%20size%3D256x256.svg' },
  { symbol: 'TSLAx', name: 'Tesla', mint: 'XsDoVfqeBukxuZHWhdvWHBhgEHjGNst4MLodqsJHzoB', image: 'https://cdn.prod.website-files.com/655f3efc4be468487052e35a/684aaf9559b2312c162731f5_Ticker%3DTSLA%2C%20Company%20Name%3DTesla%20Inc.%2C%20size%3D256x256.svg' },
  { symbol: 'AAPLx', name: 'Apple', mint: 'XsbEhLAtcf6HdfpFZ5xEMdqW8nfAvcsP5bdudRLJzJp', image: 'https://cdn.prod.website-files.com/655f3efc4be468487052e35a/6849799260ee65bf38841f90_Ticker%3DAAPL%2C%20Company%20Name%3DApple%20Inc.%2C%20size%3D256x256.svg' },
  { symbol: 'MSFTx', name: 'Microsoft', mint: 'XspzcW1PRtgf6Wj92HCiZdjzKCyFekVD8P5Ueh3dRMX', image: 'https://cdn.prod.website-files.com/655f3efc4be468487052e35a/68497bdc918924ea97fd8211_Ticker%3DMSFT%2C%20Company%20Name%3DMicrosoft%20Inc.%2C%20size%3D256x256.svg' },
  { symbol: 'GOOGLx', name: 'Alphabet', mint: 'XsCPL9dNWBMvFtTmwcCA5v3xWPSMEBCszbQdiLLq6aN', image: 'https://cdn.prod.website-files.com/655f3efc4be468487052e35a/684aae04a3d8452e0ae4bad8_Ticker%3DGOOG%2C%20Company%20Name%3DAlphabet%20Inc.%2C%20size%3D256x256.svg' },
  { symbol: 'METAx', name: 'Meta', mint: 'Xsa62P5mvPszXL1krVUnU5ar38bBSVcWAB6fmPCo5Zu', image: 'https://cdn.prod.website-files.com/655f3efc4be468487052e35a/68497dee3db1bae97b91ac05_Ticker%3DMETA%2C%20Company%20Name%3DMeta%20Platforms%20Inc.%2C%20size%3D256x256.svg' },
  { symbol: 'AMZNx', name: 'Amazon', mint: 'Xs3eBt7uRfJX8QUs4suhyU8p2M6DoUDrJyWBa8LLZsg', image: 'https://cdn.prod.website-files.com/655f3efc4be468487052e35a/68497d354d7140b01657a793_Ticker%3DAMZN%2C%20Company%20Name%3DAmazon.com%20Inc.%2C%20size%3D256x256.svg' },
  { symbol: 'AVGOx', name: 'Broadcom', mint: 'XsgSaSvNSqLTtFuyWPBhK9196Xb9Bbdyjj4fH3cPJGo', image: 'https://cdn.prod.website-files.com/655f3efc4be468487052e35a/684aaef288f41927892d12c1_Ticker%3DAVGO%2C%20Company%20Name%3DBroadcom%20Inc.%2C%20size%3D256x256.svg' },

  // Finance & Crypto
  { symbol: 'COINx', name: 'Coinbase', mint: 'Xs7ZdzSHLU9ftNJsii5fCeJhoRWSC32SQGzGQtePxNu', image: 'https://cdn.prod.website-files.com/655f3efc4be468487052e35a/684c131b2d6d8cbe9e61a3dc_Ticker%3DCOIN%2C%20Company%20Name%3DCoinbase%2C%20size%3D256x256.svg' },
  { symbol: 'HOODx', name: 'Robinhood', mint: 'XsvNBAYkrDRNhA7wPHQfX3ZUXZyZLdnCQDfHZ56bzpg', image: 'https://cdn.prod.website-files.com/655f3efc4be468487052e35a/684c0f39cede10b9afa4852f_Ticker%3DHOOD%2C%20Company%20Name%3DRobinhood%2C%20size%3D256x256.svg' },
  { symbol: 'MSTRx', name: 'MicroStrategy', mint: 'XsP7xzNPvEHS1m6qfanPUGjNmdnmsLKEoNAnHjdxxyZ', image: 'https://cdn.prod.website-files.com/655f3efc4be468487052e35a/684c0d47eee3a9c3fa12475a_Ticker%3DMSTR%2C%20Company%20Name%3DMicroStrategy%2C%20size%3D256x256.svg' },
  { symbol: 'JPMx', name: 'JPMorgan Chase', mint: 'XsMAqkcKsUewDrzVkait4e5u4y8REgtyS7jWgCpLV2C', image: 'https://cdn.prod.website-files.com/655f3efc4be468487052e35a/684acf34c10a7e0add155c61_Ticker%3DJPM%2C%20Company%20Name%3DJPMorganChase%2C%20size%3D256x256.svg' },
  { symbol: 'BACx', name: 'Bank of America', mint: 'XswsQk4duEQmCbGzfqUUWYmi7pV7xpJ9eEmLHXCaEQP', image: 'https://cdn.prod.website-files.com/655f3efc4be468487052e35a/684bf5a74604b4f162fd0efd_Ticker%3DBAC%2C%20Company%20Name%3DBank%20of%20America%20Corporation%2C%20size%3D256x256.svg' },
  { symbol: 'GSx', name: 'Goldman Sachs', mint: 'XsgaUyp4jd1fNBCxgtTKkW64xnnhQcvgaxzsbAq5ZD1', image: 'https://cdn.prod.website-files.com/655f3efc4be468487052e35a/684c114972ed2d868a1b3f95_Ticker%3DGS%2C%20Company%20Name%3DGoldman%20Sachs%2C%20size%3D256x256.svg' },
  { symbol: 'MAx', name: 'Mastercard', mint: 'XsApJFV9MAktqnAc6jqzsHVujxkGm9xcSUffaBoYLKC', image: 'https://cdn.prod.website-files.com/655f3efc4be468487052e35a/684ad1ca13c7aaa9ece4cbbf_Ticker%3DMA%2C%20Company%20Name%3DMastercard%2C%20size%3D256x256.svg' },
  { symbol: 'Vx', name: 'Visa', mint: 'XsqgsbXwWogGJsNcVZ3TyVouy2MbTkfCFhCGGGcQZ2p', image: 'https://cdn.prod.website-files.com/655f3efc4be468487052e35a/684acfd76eb8395c6d1d2210_Ticker%3DV%2C%20Company%20Name%3DVisa%2C%20size%3D256x256.svg' },

  // Media & Entertainment
  { symbol: 'NFLXx', name: 'Netflix', mint: 'XsEH7wWfJJu2ZT3UCFeVfALnVA6CP5ur7Ee11KmzVpL', image: 'https://cdn.prod.website-files.com/655f3efc4be468487052e35a/684bf6c149d917d503f6cda6_Ticker%3DNFLX%2C%20Company%20Name%3DNetflix%20Inc.%2C%20size%3D256x256.svg' },
  { symbol: 'GMEx', name: 'GameStop', mint: 'Xsf9mBktVB9BSU5kf4nHxPq5hCBJ2j2ui3ecFGxPRGc', image: 'https://cdn.prod.website-files.com/655f3efc4be468487052e35a/684c125f1c48a3dab4c66137_Ticker%3DGME%2C%20Company%20Name%3Dgamestop%2C%20size%3D256x256.svg' },

  // Healthcare & Pharma
  { symbol: 'LLYx', name: 'Eli Lilly', mint: 'Xsnuv4omNoHozR6EEW5mXkw8Nrny5rB3jVfLqi6gKMH', image: 'https://cdn.prod.website-files.com/655f3efc4be468487052e35a/684ad0eaa9a1efe9b1b7155a_Ticker%3DLLY%2C%20Company%20Name%3DLilly%2C%20size%3D256x256.svg' },
  { symbol: 'JNJx', name: 'Johnson & Johnson', mint: 'XsGVi5eo1Dh2zUpic4qACcjuWGjNv8GCt3dm5XcX6Dn', image: 'https://cdn.prod.website-files.com/655f3efc4be468487052e35a/684ace98941130a24503a315_Ticker%3DJNJ%2C%20Company%20Name%3Djohnson-johnson%2C%20size%3D256x256.svg' },
  { symbol: 'UNHx', name: 'UnitedHealth', mint: 'XszvaiXGPwvk2nwb3o9C1CX4K6zH8sez11E6uyup6fe', image: 'https://cdn.prod.website-files.com/655f3efc4be468487052e35a/684abb4c69185d8a871e2ab5_Ticker%3DUNH%2C%20Company%20Name%3DUnited%20Health%2C%20size%3D256x256.svg' },
  { symbol: 'MRKx', name: 'Merck', mint: 'XsnQnU7AdbRZYe2akqqpibDdXjkieGFfSkbkjX1Sd1X', image: 'https://cdn.prod.website-files.com/655f3efc4be468487052e35a/684be6ff5bd0a5643adf85ec_Ticker%3DMRK%2C%20Company%20Name%3DMerck%2C%20size%3D256x256.svg' },
  { symbol: 'PFEx', name: 'Pfizer', mint: 'XsAtbqkAP1HJxy7hFDeq7ok6yM43DQ9mQ1Rh861X8rw', image: 'https://cdn.prod.website-files.com/655f3efc4be468487052e35a/684be5e3c54ff3f5c6c9b36f_Ticker%3DPFE%2C%20Company%20Name%3Dpfizer%2C%20size%3D256x256.svg' },
  { symbol: 'ABBVx', name: 'AbbVie', mint: 'XswbinNKyPmzTa5CskMbCPvMW6G5CMnZXZEeQSSQoie', image: 'https://cdn.prod.website-files.com/655f3efc4be468487052e35a/684be7c58986cdaeeee5bbba_Ticker%3DABBV%2C%20Company%20Name%3DSP500%2C%20size%3D256x256.svg' },

  // Consumer & Retail
  { symbol: 'MCDx', name: "McDonald's", mint: 'XsqE9cRRpzxcGKDXj1BJ7Xmg4GRhZoyY1KpmGSxAWT2', image: 'https://cdn.prod.website-files.com/655f3efc4be468487052e35a/684bf77838b45bb94ff32be7_Ticker%3DMCD%2C%20Company%20Name%3DMcDonalds%2C%20size%3D256x256.svg' },
  { symbol: 'WMTx', name: 'Walmart', mint: 'Xs151QeqTCiuKtinzfRATnUESM2xTU6V9Wy8Vy538ci', image: 'https://cdn.prod.website-files.com/655f3efc4be468487052e35a/684bebd366d5089b2da3cf7e_Ticker%3DWMT%2C%20Company%20Name%3DWalmart%2C%20size%3D256x256.svg' },
  { symbol: 'HDx', name: 'Home Depot', mint: 'XszjVtyhowGjSC5odCqBpW1CtXXwXjYokymrk7fGKD3', image: 'https://cdn.prod.website-files.com/655f3efc4be468487052e35a/684be484171c0a11201e098d_Ticker%3DHD%2C%20Company%20Name%3DHome%20Depot%2C%20size%3D256x256.svg' },
  { symbol: 'KOx', name: 'Coca-Cola', mint: 'XsaBXg8dU5cPM6ehmVctMkVqoiRG2ZjMo1cyBJ3AykQ', image: 'https://cdn.prod.website-files.com/655f3efc4be468487052e35a/684beb344604b4f162f66f93_Ticker%3DCOKE%2C%20Company%20Name%3DCokeCola%2C%20size%3D256x256.svg' },
  { symbol: 'PEPx', name: 'PepsiCo', mint: 'Xsv99frTRUeornyvCfvhnDesQDWuvns1M852Pez91vF', image: 'https://cdn.prod.website-files.com/655f3efc4be468487052e35a/684be8662b90a208c5d5b8e5_Ticker%3DPEP%2C%20Company%20Name%3DPepsico%2C%20size%3D256x256.svg' },
  { symbol: 'PGx', name: 'Procter & Gamble', mint: 'XsYdjDjNUygZ7yGKfQaB6TxLh2gC6RRjzLtLAGJrhzV', image: 'https://cdn.prod.website-files.com/655f3efc4be468487052e35a/684be3c6fa6a62fb260a51e3_Ticker%3DPG%2C%20Company%20Name%3DProctor%20%26%20Gamble%2C%20size%3D256x256.svg' },

  // ETFs
  { symbol: 'SPYx', name: 'S&P 500', mint: 'XsoCS1TfEyfFhfvj8EtZ528L3CaKBDBRqRapnBbDF2W', image: 'https://cdn.prod.website-files.com/655f3efc4be468487052e35a/685116624ae31d5ceb724895_Ticker%3DSPX%2C%20Company%20Name%3DSP500%2C%20size%3D256x256.svg' },
  { symbol: 'QQQx', name: 'Nasdaq-100', mint: 'Xs8S1uUs1zvS2p7iwtsG3b6fkhpvmwz4GYU3gWAmWHZ', image: 'https://cdn.prod.website-files.com/655f3efc4be468487052e35a/68511cb6e367f19f06664527_QQQx.svg' },
  { symbol: 'VTIx', name: 'Vanguard Total Stock', mint: 'XsssYEQjzxBCFgvYFFNuhJFBeHNdLWYeUSP8F45cDr9', image: 'https://cdn.prod.website-files.com/655f3efc4be468487052e35a/68511e335ee1314f602d9a7c_Ticker%3DVTI%2C%20Company%20Name%3DVanguard%2C%20size%3D256x256.svg' },
  { symbol: 'GLDx', name: 'Gold ETF', mint: 'Xsv9hRk1z5ystj9MhnA7Lq4vjSsLwzL2nxrwmwtD3re', image: 'https://cdn.prod.website-files.com/655f3efc4be468487052e35a/685123a7747987b071b10d47_Ticker%3DGLD%2C%20Company%20Name%3DGold%2C%20size%3D256x256.svg' },

  // Tech
  { symbol: 'CRMx', name: 'Salesforce', mint: 'XsczbcQ3zfcgAEt9qHQES8pxKAVG5rujPSHQEXi4kaN', image: 'https://cdn.prod.website-files.com/655f3efc4be468487052e35a/684bf3670e24ef4c92a6a7fc_Ticker%3DCRM%2C%20Company%20Name%3DSP500%2C%20size%3D256x256.svg' },
  { symbol: 'ORCLx', name: 'Oracle', mint: 'XsjFwUPiLofddX5cWFHW35GCbXcSu1BCUGfxoQAQjeL', image: 'https://cdn.prod.website-files.com/655f3efc4be468487052e35a/684bf1ecae4eb4a817da9941_Ticker%3DORCL%2C%20Company%20Name%3DSP500%2C%20size%3D256x256.svg' },
  { symbol: 'CSCOx', name: 'Cisco', mint: 'Xsr3pdLQyXvDJBFgpR5nexCEZwXvigb8wbPYp4YoNFf', image: 'https://cdn.prod.website-files.com/655f3efc4be468487052e35a/684bec77bfaeef7ac61f7231_Ticker%3DCSCO%2C%20Company%20Name%3DCisco%20Systems%20Inc.%2C%20size%3D256x256.svg' },
  { symbol: 'INTCx', name: 'Intel', mint: 'XshPgPdXFRWB8tP1j82rebb2Q9rPgGX37RuqzohmArM', image: 'https://cdn.prod.website-files.com/655f3efc4be468487052e35a/684c0a334cac334b4a41651b_Ticker%3DINTC%2C%20Company%20Name%3DIntel%20Corp%2C%20size%3D256x256.svg' },
  { symbol: 'IBMx', name: 'IBM', mint: 'XspwhyYPdWVM8XBHZnpS9hgyag9MKjLRyE3tVfmCbSr', image: 'https://cdn.prod.website-files.com/655f3efc4be468487052e35a/684bfb32f7000e98d733283f_Ticker%3DIBM%2C%20Company%20Name%3DIBM%2C%20size%3D256x256.svg' },
  { symbol: 'PLTRx', name: 'Palantir', mint: 'XsoBhf2ufR8fTyNSjqfU71DYGaE6Z3SUGAidpzriAA4', image: 'https://cdn.prod.website-files.com/655f3efc4be468487052e35a/684c0c4c0e5466272c52958b_Ticker%3DPLTR%2C%20Company%20Name%3DSP500%2C%20size%3D256x256.svg' },
  { symbol: 'CRWDx', name: 'CrowdStrike', mint: 'Xs7xXqkcK7K8urEqGg52SECi79dRp2cEKKuYjUePYDw', image: 'https://cdn.prod.website-files.com/655f3efc4be468487052e35a/684c10fbaf9d90e3d974ae23_Ticker%3DCRWD%2C%20Company%20Name%3DCrowdstrike%2C%20size%3D256x256.svg' },
  { symbol: 'APPx', name: 'AppLovin', mint: 'XsPdAVBi8Zc1xvv53k4JcMrQaEDTgkGqKYeh7AYgPHV', image: 'https://cdn.prod.website-files.com/655f3efc4be468487052e35a/684c0deccaecf631c0c174ea_Ticker%3DAPP%2C%20Company%20Name%3Dapp%20lovin%2C%20size%3D256x256.svg' },
];

export async function getStockTokens(limit: number = 50): Promise<StockToken[]> {
  // Check Redis cache first (10 minute TTL for stock data - increased since it's more static)
  const cacheKey = `stocks:${limit}`;
  try {
    const cached = await redis.get(cacheKey);
    if (cached) {
      logger.debug("Returning cached stock tokens");
      return safeParse(cached);
    }
  } catch (error) {
    logger.warn({ err: error }, "Redis cache read failed for stocks");
  }

  try {
    logger.info({ limit }, "Fetching tokenized stocks");

    // Fetch all xStocks tokens using their mint addresses
    const tokensToFetch = XSTOCKS_TOKENS.slice(0, limit);
    const stockPromises = tokensToFetch.map(token =>
      fetchTokenByMint(token.mint, token.symbol, token.name, token.image)
    );

    const stockResults = await Promise.allSettled(stockPromises);

    const stocks: StockToken[] = stockResults
      .filter((result): result is PromiseFulfilledResult<StockToken | null> =>
        result.status === 'fulfilled' && result.value !== null
      )
      .map(result => result.value)
      .filter((stock): stock is StockToken => stock !== null);

    logger.info({ count: stocks.length }, "Found tokenized stocks");

    // Sort by volume descending
    stocks.sort((a, b) => b.volume24h - a.volume24h);

    // Cache result in Redis for 10 minutes (longer cache since stocks don't change as frequently)
    try {
      await redis.setex(cacheKey, 600, safeStringify(stocks));
    } catch (error) {
      logger.warn({ err: error }, "Failed to cache stock tokens");
    }

    return stocks;

  } catch (error) {
    logger.error({ err: error }, "Error fetching stock tokens");
    return [];
  }
}

// Fetch token data by mint address (much faster and more reliable than symbol search)
async function fetchTokenByMint(mint: string, symbol: string, name: string, imageUrl?: string): Promise<StockToken | null> {
  try {
    const response = await robustFetch(
      `https://api.dexscreener.com/latest/dex/tokens/${mint}`,
      {
        timeout: 3000,
        retries: 0,
        retryDelay: 0
      }
    );

    if (!response.ok) {
      return null;
    }

    const data = await response.json() as any;
    const pairs = data.pairs || [];

    // Find the best Solana pair (highest liquidity)
    const solanaPairs = pairs
      .filter((pair: any) => pair.chainId === 'solana')
      .sort((a: any, b: any) => {
        const aLiq = parseFloat(a.liquidity?.usd || '0');
        const bLiq = parseFloat(b.liquidity?.usd || '0');
        return bLiq - aLiq;
      });

    const bestPair = solanaPairs[0];

    if (!bestPair || !bestPair.priceUsd) {
      return null;
    }

    // Use xStocks CDN image first, then fallback to DexScreener
    const logoURI = imageUrl ||
                    bestPair.info?.imageUrl ||
                    bestPair.baseToken?.imageUrl ||
                    bestPair.info?.logo ||
                    null;

    return {
      mint,
      symbol,
      name,
      logoURI,
      priceUsd: parseFloat(bestPair.priceUsd || '0'),
      priceChange24h: parseFloat(bestPair.priceChange?.h24 || '0'),
      priceChange5m: parseFloat(bestPair.priceChange?.m5 || '0'),
      priceChange1h: parseFloat(bestPair.priceChange?.h1 || '0'),
      priceChange6h: parseFloat(bestPair.priceChange?.h6 || '0'),
      volume24h: parseFloat(bestPair.volume?.h24 || '0'),
      marketCapUsd: parseFloat(bestPair.marketCap || '0') || null,
      liquidity: parseFloat(bestPair.liquidity?.usd || '0'),
    };

  } catch (error) {
    logger.error({ symbol, mint, err: error }, "Error fetching token");
    return null;
  }
}
