-- CreateTable
CREATE TABLE "PerpPosition" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "mint" TEXT NOT NULL,
    "side" TEXT NOT NULL,
    "leverage" DECIMAL(65,30) NOT NULL,
    "entryPrice" DECIMAL(65,30) NOT NULL,
    "currentPrice" DECIMAL(65,30) NOT NULL,
    "positionSize" DECIMAL(65,30) NOT NULL,
    "marginAmount" DECIMAL(65,30) NOT NULL,
    "unrealizedPnL" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "marginRatio" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "liquidationPrice" DECIMAL(65,30) NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "openedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "closedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PerpPosition_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PerpTrade" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "positionId" TEXT,
    "mint" TEXT NOT NULL,
    "side" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "leverage" DECIMAL(65,30) NOT NULL,
    "quantity" DECIMAL(65,30) NOT NULL,
    "entryPrice" DECIMAL(65,30) NOT NULL,
    "exitPrice" DECIMAL(65,30),
    "marginUsed" DECIMAL(65,30) NOT NULL,
    "pnl" DECIMAL(65,30),
    "fees" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PerpTrade_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Liquidation" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "positionId" TEXT NOT NULL,
    "mint" TEXT NOT NULL,
    "side" TEXT NOT NULL,
    "liquidationPrice" DECIMAL(65,30) NOT NULL,
    "positionSize" DECIMAL(65,30) NOT NULL,
    "marginLost" DECIMAL(65,30) NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Liquidation_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PerpPosition_userId_idx" ON "PerpPosition"("userId");
CREATE INDEX "PerpPosition_status_idx" ON "PerpPosition"("status");
CREATE INDEX "PerpPosition_status_marginRatio_idx" ON "PerpPosition"("status", "marginRatio");
CREATE INDEX "PerpPosition_userId_mint_status_idx" ON "PerpPosition"("userId", "mint", "status");

-- CreateIndex
CREATE INDEX "PerpTrade_userId_timestamp_idx" ON "PerpTrade"("userId", "timestamp" DESC);
CREATE INDEX "PerpTrade_mint_timestamp_idx" ON "PerpTrade"("mint", "timestamp" DESC);
CREATE INDEX "PerpTrade_positionId_idx" ON "PerpTrade"("positionId");

-- CreateIndex
CREATE INDEX "Liquidation_userId_timestamp_idx" ON "Liquidation"("userId", "timestamp" DESC);
CREATE INDEX "Liquidation_positionId_idx" ON "Liquidation"("positionId");

-- AddForeignKey
ALTER TABLE "PerpPosition" ADD CONSTRAINT "PerpPosition_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PerpTrade" ADD CONSTRAINT "PerpTrade_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PerpTrade" ADD CONSTRAINT "PerpTrade_positionId_fkey" FOREIGN KEY ("positionId") REFERENCES "PerpPosition"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Liquidation" ADD CONSTRAINT "Liquidation_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
