import { Command } from "commander";
import { Git } from "../lib/git.js";
import { Logger, confirm, truncateText } from "../utils.js";
import { BaseOptions, ValidationError } from "../types.js";

interface FixupOptions extends BaseOptions {
  yes?: boolean;
  dryRun?: boolean;
  message?: string;
}

export const fixupCommand = new Command("fixup")
  .description("Quickly fix the last commit with current changes")
  .option("-m, --message <message>", "update the commit message")
  .option("--dry-run", "show what would be done without executing")
  .option("--yes", "skip confirmation prompts")
  .option("--verbose", "enable verbose logging")
  .action(async (options: FixupOptions) => {
    const logger = new Logger(options);
    const git = new Git(logger);

    try {
      // Check if we have any changes to fix up
      const status = await git.getStatus();
      const hasChanges = status.staged.length > 0 || status.unstaged.length > 0;
      const hasMessage = !!options.message;

      if (!hasChanges && !hasMessage) {
        throw new ValidationError(
          "Nothing to fixup. Stage some changes or provide a new message with --message"
        );
      }

      // Get the last commit
      const lastCommit = await git.getCommits("HEAD", 1);
      if (lastCommit.length === 0) {
        throw new ValidationError("No commits found to fixup");
      }

      const commit = lastCommit[0];
      logger.info(`📋 Last commit to fixup:`);
      logger.info(
        `  ${commit.sha.substring(0, 8)} ${truncateText(commit.subject, 60)}`
      );

      // Check if commit is pushed
      const upstream = await git.getUpstream();
      let isPushed = false;
      if (upstream) {
        const unpushedCount = await git.countCommits(`${upstream}..HEAD`);
        isPushed = unpushedCount === 0;

        if (isPushed) {
          logger.warn("⚠️  Last commit appears to be pushed to remote!");
          logger.warn(
            "   Fixing up will require force-push and affects others"
          );
        }
      }

      // Show what will be fixed
      if (hasChanges) {
        logger.info(`\n📁 Changes to include:`);
        if (status.staged.length > 0) {
          logger.info(`  • ${status.staged.length} staged files`);
          for (const file of status.staged.slice(0, 5)) {
            logger.info(`    - ${file}`);
          }
          if (status.staged.length > 5) {
            logger.info(`    ... and ${status.staged.length - 5} more`);
          }
        }
        if (status.unstaged.length > 0) {
          logger.info(
            `  • ${status.unstaged.length} unstaged files (will be staged)`
          );
          for (const file of status.unstaged.slice(0, 5)) {
            logger.info(`    - ${file}`);
          }
          if (status.unstaged.length > 5) {
            logger.info(`    ... and ${status.unstaged.length - 5} more`);
          }
        }
      }

      if (hasMessage) {
        logger.info(`\n📝 New commit message:`);
        logger.info(`  "${options.message}"`);
      }

      if (options.dryRun) {
        logger.info("\n📋 Dry run - would perform these actions:");
        if (status.unstaged.length > 0) {
          logger.info(`1. Stage ${status.unstaged.length} unstaged files`);
        }
        if (hasMessage) {
          logger.info(`2. Amend commit with new message: "${options.message}"`);
        } else {
          logger.info("2. Amend commit with staged changes");
        }
        return;
      }

      // Confirm the operation
      if (!options.yes) {
        const warningMsg = isPushed
          ? "⚠️  COMMIT IS PUSHED! Fixup anyway? (requires force-push)"
          : "Fixup the last commit with current changes?";

        const confirmed = await confirm(warningMsg, false, options);

        if (!confirmed) {
          logger.info("Operation cancelled");
          return;
        }
      }

      // Stage unstaged changes
      if (status.unstaged.length > 0) {
        logger.info("📦 Staging unstaged changes...");
        await git.exec(["add", "-A"]);
      }

      // Perform the fixup
      logger.info("🔧 Fixing up last commit...");

      if (hasMessage && options.message) {
        await git.exec(["commit", "--amend", "-m", options.message]);
      } else {
        await git.exec(["commit", "--amend", "--no-edit"]);
      }

      const newCommit = await git.getCommits("HEAD", 1);
      const fixedCommit = newCommit[0];

      logger.success("✅ Commit fixup completed successfully!");

      logger.info("\n📝 Summary:");
      logger.info(`  • Fixed commit: ${fixedCommit.sha.substring(0, 8)}`);
      logger.info(`  • Message: ${truncateText(fixedCommit.subject, 60)}`);
      if (hasChanges) {
        const totalFiles = status.staged.length + status.unstaged.length;
        logger.info(`  • Added: ${totalFiles} files to commit`);
      }

      logger.info("\n🚀 Next steps:");
      logger.info("  • Review the fixed commit: git show HEAD");

      if (isPushed) {
        logger.warn("  • Force-push required: git push --force-with-lease");
        logger.warn("  • ⚠️  This will rewrite history - notify your team!");
      } else {
        logger.info("  • Push when ready: git push");
      }
    } catch (error) {
      logger.error(`Fixup operation failed: ${error}`);
      throw error;
    }
  });
