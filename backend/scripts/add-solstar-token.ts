
import { PrismaClient } from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';

const prisma = new PrismaClient({
  datasources: {
    db: {
      url: "postgresql://postgres:cmvCRszpAAfgyvOZaWrHrWJxeEvvYbZb@metro.proxy.rlwy.net:13936/railway"
    }
  }
});

async function main() {
  const mint = 'BNsBVZDshycdbsKYstjtbcj3RJPHBUBcRquGJkFmpump';
  const symbol = 'SOLSTAR';
  const name = 'Sol Star Trading';
  
  console.log(`Adding token ${symbol} (${mint})...`);

  try {
    const token = await prisma.tokenDiscovery.upsert({
      where: { mint },
      update: {
        state: 'new', // Ensure it's visible in 'new'/Warp Pipes
        hotScore: new Decimal(999), // High score to appear at top
        lastUpdatedAt: new Date(),
      },
      create: {
        mint,
        symbol,
        name,
        // Use a generic placeholder if we don't have the explicit one, UI might fallback or fetch it
        logoURI: 'https://pump.fun/logo.png', 
        state: 'new',
        bondingCurveProgress: new Decimal(100),
        hotScore: new Decimal(999), 
        watcherCount: 420,
        freezeRevoked: true,
        mintRenounced: true,
        creatorVerified: true,
        firstSeenAt: new Date(),
        lastUpdatedAt: new Date(),
        stateChangedAt: new Date(),
      }
    });

    console.log('✅ Token added/updated successfully:', token);
  } catch (error) {
    console.error('❌ Error adding token:', error);
  } finally {
    await prisma.$disconnect();
  }
}

main();
