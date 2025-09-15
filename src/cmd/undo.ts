import { Command } from "commander";
import { Git } from "../lib/git.js";
import { Logger, confirm, pluralize } from "../utils.js";
import { BaseOptions, ValidationError } from "../types.js";

interface UndoOptions extends BaseOptions {
  yes?: boolean;
  dryRun?: boolean;
  commits?: string;
}

export const undoCommand = new Command("undo")
  .description("Undo recent commits or changes (with safety)")
  .option("-n, --commits <number>", "number of commits to undo", "1")
  .option("--dry-run", "show what would be done without executing")
  .option("--yes", "skip confirmation prompts")
  .option("--verbose", "enable verbose logging")
  .action(async (options: UndoOptions) => {
    const logger = new Logger(options);
    const git = new Git(logger);

    try {
      const commitCount = parseInt(options.commits || "1", 10);
      if (isNaN(commitCount) || commitCount < 1) {
        throw new ValidationError(
          "Number of commits must be a positive integer"
        );
      }

      if (commitCount > 10) {
        throw new ValidationError(
          "Cannot undo more than 10 commits at once for safety"
        );
      }

      logger.info(
        `🔍 Analyzing last ${pluralize(commitCount, "commit")} to undo...`
      );

      // Get commits to undo
      const commits = await git.getCommits("HEAD", commitCount);
      if (commits.length === 0) {
        throw new ValidationError("No commits found to undo");
      }

      if (commits.length < commitCount) {
        logger.warn(
          `Only ${commits.length} commits available (requested ${commitCount})`
        );
      }

      // Show what will be undone
      logger.info(`\n📋 Commits to undo:`);
      for (let i = 0; i < Math.min(commits.length, commitCount); i++) {
        const commit = commits[i];
        logger.info(
          `  ${i + 1}. ${commit.sha.substring(0, 8)} ${commit.subject}`
        );
      }

      // Check if any commits are pushed
      const upstream = await git.getUpstream();
      let hasUnpushedCommits = false;
      if (upstream) {
        const unpushedCount = await git.countCommits(`${upstream}..HEAD`);
        hasUnpushedCommits = unpushedCount >= commitCount;

        if (!hasUnpushedCommits) {
          logger.warn("⚠️  Some commits may already be pushed to remote!");
          logger.warn(
            "   Undoing pushed commits requires force-push and affects others"
          );
        }
      }

      if (options.dryRun) {
        logger.info("\n📋 Dry run - would perform these actions:");
        logger.info(`1. Create safety tag pointing to current HEAD`);
        logger.info(
          `2. Reset HEAD~${commitCount} (keep changes in working directory)`
        );
        logger.info(`3. Show status of uncommitted changes`);
        return;
      }

      // Confirm the operation
      if (!options.yes) {
        const warningMsg = hasUnpushedCommits
          ? `Undo last ${pluralize(
              commitCount,
              "commit"
            )}? Changes will be preserved in working directory.`
          : `⚠️  SOME COMMITS MAY BE PUSHED! Undo last ${pluralize(
              commitCount,
              "commit"
            )}?`;

        const confirmed = await confirm(warningMsg, false, options);

        if (!confirmed) {
          logger.info("Operation cancelled");
          return;
        }
      }


      // Create safety tag with random suffix to prevent collisions
      const timestamp = new Date()
        .toISOString()
        .replace(/[-:]/g, "")
        .replace(/\..+/, "")
        .replace("T", "-");
      const randomSuffix = Math.random().toString(36).substring(2, 8);
      const tagName = `oops/undo-${commitCount}-commits-${timestamp}-${randomSuffix}`;

      logger.info("🛡️  Creating safety tag...");
      await git.exec([
        "tag",
        "-a",
        tagName,
        "-m",
        `Safety backup before undoing ${commitCount} commits`,
        "HEAD",
      ]);
      logger.success(`✅ Created safety tag: ${tagName}`);

      // Perform the undo (soft reset to preserve changes)
      logger.info(`🔄 Undoing last ${pluralize(commitCount, "commit")}...`);
      await git.exec(["reset", "--soft", `HEAD~${commitCount}`]);

      // Show current status
      const status = await git.getStatus();

      logger.success(
        `✅ Successfully undid ${pluralize(commitCount, "commit")}`
      );

      logger.info("\n📝 Summary:");
      logger.info(`  • Undid: ${commitCount} commits`);
      logger.info(`  • Safety tag: ${tagName}`);
      logger.info(
        `  • Changes preserved in: ${status.staged.length} staged files`
      );

      if (status.staged.length > 0) {
        logger.info("\n📁 Staged files (from undone commits):");
        for (const file of status.staged.slice(0, 10)) {
          logger.info(`  • ${file}`);
        }
        if (status.staged.length > 10) {
          logger.info(`  ... and ${status.staged.length - 10} more`);
        }
      }

      logger.info("\n🚀 Next steps:");
      logger.info("  • Review staged changes: git status");
      logger.info("  • Make new commits: git commit");
      logger.info(`  • To restore undone commits: git reset --hard ${tagName}`);

      if (!hasUnpushedCommits) {
        logger.warn(
          "\n⚠️  Note: If you had pushed commits, you'll need to force-push:"
        );
        logger.warn("   git push --force-with-lease");
      }
    } catch (error) {
      logger.error(`Undo operation failed: ${error}`);
      throw error;
    }
  });
