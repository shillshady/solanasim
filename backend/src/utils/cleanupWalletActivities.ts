/**
 * Utility script to clean up old wallet activities without images
 * Run this once to remove legacy data from before image filtering was implemented
 *
 * Usage: npx tsx src/utils/cleanupWalletActivities.ts
 */

import prisma from "../plugins/prisma.js";
import logger from "../utils/logger.js";

async function cleanupActivitiesWithoutImages() {
  logger.info("Starting cleanup of wallet activities without images");

  try {
    // Find activities without images
    const activitiesWithoutImages = await prisma.walletActivity.findMany({
      where: {
        OR: [
          {
            type: "BUY",
            tokenOutLogoURI: null,
          },
          {
            type: "SELL",
            tokenInLogoURI: null,
          },
          {
            type: "SWAP",
            AND: [
              { tokenInLogoURI: null },
              { tokenOutLogoURI: null },
            ],
          },
        ],
      },
      select: {
        id: true,
        signature: true,
        type: true,
        walletAddress: true,
        timestamp: true,
      },
    });

    logger.info({ count: activitiesWithoutImages.length }, "Found activities without images");

    if (activitiesWithoutImages.length === 0) {
      logger.info("No cleanup needed - all activities have images");
      return;
    }

    // Show sample of what will be deleted
    logger.info("Sample of activities to be deleted:");
    activitiesWithoutImages.slice(0, 5).forEach((activity) => {
      logger.info({ type: activity.type, signature: activity.signature.slice(0, 8), timestamp: activity.timestamp }, "Activity to delete");
    });

    // Confirm deletion
    logger.warn({ count: activitiesWithoutImages.length }, "This will DELETE activities from the database. Press Ctrl+C to cancel, waiting 5 seconds...");

    await new Promise((resolve) => setTimeout(resolve, 5000));

    // Delete activities
    const result = await prisma.walletActivity.deleteMany({
      where: {
        OR: [
          {
            type: "BUY",
            tokenOutLogoURI: null,
          },
          {
            type: "SELL",
            tokenInLogoURI: null,
          },
          {
            type: "SWAP",
            AND: [
              { tokenInLogoURI: null },
              { tokenOutLogoURI: null },
            ],
          },
        ],
      },
    });

    logger.info({ deletedCount: result.count }, "Successfully deleted activities without images");
    logger.info("Cleanup complete. Wallet tracker will now only show activities with images.");
  } catch (error) {
    logger.error({ err: error }, "Error during cleanup");
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// Run cleanup
cleanupActivitiesWithoutImages()
  .then(() => process.exit(0))
  .catch((error) => {
    logger.error({ err: error }, "Cleanup script failed");
    process.exit(1);
  });
