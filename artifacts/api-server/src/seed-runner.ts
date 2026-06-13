import { seed } from "./seed";
import { logger } from "./lib/logger";

seed()
  .then(() => process.exit(0))
  .catch((err) => {
    logger.error({ err }, "Seed failed");
    process.exit(1);
  });
