#!/usr/bin/env node

import { Command } from "commander";
import { Logger } from "./utils.js";
import { GitOopsError } from "./types.js";

// Import only the core commands
import { wrongBranchCommand } from "./cmd/wrongBranch.js";
import { splitCommand } from "./cmd/split.js";
import { yankCommand } from "./cmd/yank.js";
import { pocketCommand } from "./cmd/pocket.js";

const packageJson = await import("../package.json", { with: { type: "json" } });

async function main() {
  const program = new Command();

  program
    .name("git-oops")
    .description("A simple Git helper for common workflow fixes")
    .version(packageJson.default.version)
    .option("--verbose", "enable verbose logging")
    .option("--no-color", "disable colored output");

  // Add core commands only
  program.addCommand(wrongBranchCommand);
  program.addCommand(splitCommand);
  program.addCommand(yankCommand);
  program.addCommand(pocketCommand);

  // Error handling
  program.exitOverride();

  try {
    await program.parseAsync();
  } catch (error: any) {
    const logger = new Logger({ noColor: process.env.NO_COLOR === "1" });

    if (
      error.code === "commander.help" ||
      error.code === "commander.helpDisplayed"
    ) {
      process.exit(0);
    }

    if (error.code === "commander.version") {
      process.exit(0);
    }

    handleError(error, logger);
  }
}

function handleError(error: any, logger: Logger) {
  if (error instanceof GitOopsError) {
    logger.error(error.message);
    process.exit(error.code);
  } else {
    logger.error(`Unexpected error: ${error.message || error}`);
    process.exit(1);
  }
}

// Run main function
main().catch((error) => {
  const logger = new Logger({ noColor: process.env.NO_COLOR === "1" });
  handleError(error, logger);
});
