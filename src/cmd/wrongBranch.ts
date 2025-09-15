import { Command } from "commander";
import { Git } from "../lib/git.js";
import {
  Logger,
  confirm,
  sanitizeBranchName,
  truncateText,
  pluralize,
  isProtectedBranch,
} from "../utils.js";
import { BaseOptions, ValidationError } from "../types.js";

interface WrongBranchOptions extends BaseOptions {
  yes?: boolean;
}

export const wrongBranchCommand = new Command("wrong-branch")
  .description(
    "Move commits from current branch to a new branch and reset current branch to upstream"
  )
  .argument("[new-branch]", "name of the new branch to create (optional)")
  .option("--dry-run", "show what would be done without executing")
  .option("--yes", "skip confirmation prompts")
  .option("--verbose", "enable verbose logging")
  .action(
    async (newBranchName: string | undefined, options: WrongBranchOptions) => {
      const logger = new Logger(options);
      const git = new Git(logger);

      try {
        // Get current branch
        const currentBranch = await git.getCurrentBranch();
        logger.verbose(`Current branch: ${currentBranch}`);

        // Check if current branch is protected
        if (isProtectedBranch(currentBranch) && !options.yes) {
          throw new ValidationError(
            `Branch '${currentBranch}' appears to be protected. Use --yes to proceed anyway.`
          );
        }

        // Get upstream
        const upstream = await git.getUpstream(currentBranch);
        if (!upstream) {
          throw new ValidationError(
            `Branch '${currentBranch}' has no upstream. ` +
              `Set upstream with: git push -u origin ${currentBranch}`
          );
        }

        logger.verbose(`Upstream: ${upstream}`);

        // Count unique commits
        const uniqueCommits = await git.countCommits(`${upstream}..HEAD`);
        logger.verbose(`Unique commits: ${uniqueCommits}`);

        if (uniqueCommits === 0) {
          logger.success(
            "Nothing to move - current branch is already up to date with upstream"
          );
          return;
        }

        // Get commits to move
        const commits = await git.getCommits(`${upstream}..HEAD`);
        logger.info(`Found ${pluralize(uniqueCommits, "commit")} to move:`);

        for (const commit of commits.slice(0, 5)) {
          logger.info(
            `  ${commit.sha.substring(0, 8)} ${truncateText(commit.subject, 60)}`
          );
        }

        if (commits.length > 5) {
          logger.info(`  ... and ${commits.length - 5} more`);
        }

        // Determine target branch name
        let targetBranch: string;
        if (newBranchName) {
          targetBranch = newBranchName;
        } else {
          const lastCommit = commits[0];
          const sanitizedSubject = sanitizeBranchName(lastCommit.subject);
          targetBranch = `fix/${sanitizedSubject}`;
        }

        logger.info(`Target branch: ${targetBranch}`);

        if (options.dryRun) {
          logger.info("\n📋 Dry run - would perform these actions:");
          logger.info(`1. Create branch '${targetBranch}' at current HEAD`);
          logger.info(`2. Switch back to '${currentBranch}'`);
          logger.info(`3. Reset '${currentBranch}' to '${upstream}'`);
          logger.info(`4. Switch to '${targetBranch}'`);
          return;
        }

        // Confirm operation
        if (!options.yes) {
          const confirmed = await confirm(
            `Move ${pluralize(uniqueCommits, "commit")} from '${currentBranch}' to new branch '${targetBranch}'?`,
            false,
            options
          );

          if (!confirmed) {
            logger.info("Operation cancelled");
            return;
          }
        }

        // Perform the operation
        logger.info("🚀 Starting wrong-branch operation...");

        // 1. Create new branch at current HEAD
        logger.info(`Creating branch '${targetBranch}'...`);
        await git.createBranch(targetBranch);

        // 2. Switch back to original branch
        logger.verbose(`Switching back to '${currentBranch}'...`);
        await git.switchBranch(currentBranch);

        // 3. Reset to upstream
        logger.info(`Resetting '${currentBranch}' to '${upstream}'...`);
        await git.resetHard(upstream);

        // 4. Switch to new branch
        logger.verbose(`Switching to '${targetBranch}'...`);
        await git.switchBranch(targetBranch);

        // Success!
        logger.success(
          `✅ Successfully moved ${pluralize(uniqueCommits, "commit")} to '${targetBranch}'`
        );
        logger.info(`\n📝 Summary:`);
        logger.info(`  • Created branch: ${targetBranch}`);
        logger.info(`  • Reset ${currentBranch} to: ${upstream}`);
        logger.info(`  • Currently on: ${targetBranch}`);

        logger.info(`\n🚀 Next steps:`);
        logger.info(`  • Review your commits on '${targetBranch}'`);
        logger.info(`  • Push when ready: git push -u origin ${targetBranch}`);
      } catch (error) {
        logger.error(`Wrong-branch operation failed: ${error}`);
        throw error;
      }
    }
  );
