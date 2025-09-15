import { Command } from "commander";
import { Git } from "../lib/git.js";
import { Logger, confirm } from "../utils.js";
import { BaseOptions } from "../types.js";

interface SaveOptions extends BaseOptions {
  message?: string;
  yes?: boolean;
}

export const saveCommand = new Command("save")
  .description(
    "Quickly save all changes with a commit (like 'git add . && git commit')"
  )
  .option("-m, --message <message>", "commit message", "WIP: quick save")
  .option("--yes", "skip confirmation prompts")
  .option("--verbose", "enable verbose logging")
  .action(async (options: SaveOptions) => {
    const logger = new Logger(options);
    const git = new Git(logger);

    try {
      // Check current status
      const status = await git.getStatus();
      const totalChanges =
        status.staged.length + status.unstaged.length + status.untracked.length;

      if (totalChanges === 0) {
        logger.info("📁 Working directory is clean - nothing to save");
        return;
      }

      logger.info(`📦 Found ${totalChanges} files to save:`);
      if (status.staged.length > 0) {
        logger.info(`  • ${status.staged.length} already staged`);
      }
      if (status.unstaged.length > 0) {
        logger.info(`  • ${status.unstaged.length} modified`);
      }
      if (status.untracked.length > 0) {
        logger.info(`  • ${status.untracked.length} untracked`);
      }

      // Show some file examples
      const allFiles = [
        ...status.staged,
        ...status.unstaged,
        ...status.untracked,
      ];
      logger.info("\n📁 Files to save:");
      for (const file of allFiles.slice(0, 8)) {
        logger.info(`  • ${file}`);
      }
      if (allFiles.length > 8) {
        logger.info(`  ... and ${allFiles.length - 8} more`);
      }

      logger.info(`\n📝 Commit message: "${options.message}"`);

      // Confirm if not using --yes
      if (!options.yes) {
        const confirmed = await confirm(
          `Save all ${totalChanges} changes with commit message "${options.message}"?`,
          true,
          options
        );

        if (!confirmed) {
          logger.info("Save operation cancelled");
          return;
        }
      }

      // Stage everything
      logger.info("📦 Staging all changes...");
      await git.exec(["add", "-A"]);

      // Commit
      logger.info("💾 Creating commit...");
      await git.exec(["commit", "-m", options.message || "WIP: quick save"]);

      // Get the new commit info
      const lastCommit = await git.getCommits("HEAD", 1);
      const commit = lastCommit[0];

      logger.success("✅ All changes saved successfully!");

      logger.info("\n📝 Summary:");
      logger.info(`  • Commit: ${commit.sha.substring(0, 8)}`);
      logger.info(`  • Message: ${commit.subject}`);
      logger.info(`  • Files: ${totalChanges} saved`);

      logger.info("\n🚀 Next steps:");
      logger.info("  • Review the commit: git show HEAD");
      logger.info("  • Push when ready: git push");
      logger.info(
        "  • Or amend message: git commit --amend -m 'better message'"
      );
    } catch (error) {
      logger.error(`Save operation failed: ${error}`);
      throw error;
    }
  });
