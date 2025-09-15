import { Command } from "commander";
import { Git } from "../lib/git.js";
import { Logger, confirm, isValidSha } from "../utils.js";
import { BaseOptions, ValidationError } from "../types.js";

interface RevertMergeOptions extends BaseOptions {
  mainline?: string;
  yes?: boolean;
  dryRun?: boolean;
}

export const revertMergeCommand = new Command("revert-merge")
  .description("Safely revert a merge commit")
  .argument("<merge-sha>", "SHA of the merge commit to revert")
  .option("-m, --mainline <parent>", "parent number to revert to (default: 1)", "1")
  .option("--dry-run", "show what would be done without executing")
  .option("--yes", "skip confirmation prompts")
  .option("--verbose", "enable verbose logging")
  .action(async (mergeSha: string, options: RevertMergeOptions) => {
    const logger = new Logger(options);
    const git = new Git(logger);

    try {
      // Validate inputs
      if (!isValidSha(mergeSha)) {
        throw new ValidationError(`Invalid SHA: ${mergeSha}`);
      }

      logger.info(`🔍 Analyzing merge commit ${mergeSha}...`);

      // Verify it's a merge commit by checking parents
      let parents: string[];
      try {
        const parentOutput = await git.exec(["rev-list", "--parents", "-n", "1", mergeSha]);
        const parts = parentOutput.trim().split(" ");
        parents = parts.slice(1); // Remove the commit itself
      } catch (error) {
        throw new ValidationError(`Commit ${mergeSha} not found: ${error}`);
      }

      if (parents.length < 2) {
        throw new ValidationError(`Commit ${mergeSha} is not a merge commit`);
      }

      // Validate mainline
      const mainline = parseInt(options.mainline || "1", 10);
      if (isNaN(mainline) || mainline < 1 || mainline > parents.length) {
        throw new ValidationError(
          `Invalid mainline ${options.mainline}. Must be between 1 and ${parents.length}`
        );
      }

      const mainlineParent = parents[mainline - 1];

      logger.info(`📋 Merge commit details:`);
      logger.info(`  • Merge SHA: ${mergeSha}`);
      logger.info(`  • Mainline parent (${mainline}): ${mainlineParent.substring(0, 8)}`);
      logger.info(`  • Total parents: ${parents.length}`);

      if (options.dryRun) {
        logger.info("\n📋 Dry run - would perform these actions:");
        logger.info(`1. Create safety tag pointing to current HEAD`);
        logger.info(`2. Revert merge ${mergeSha} with mainline ${mainline}`);
        logger.info(`3. Handle any conflicts if they occur`);
        return;
      }

      // Confirm the operation
      if (!options.yes) {
        const confirmed = await confirm(
          `Revert merge ${mergeSha.substring(0, 8)} with mainline ${mainline}?`,
          false,
          options
        );

        if (!confirmed) {
          logger.info("Operation cancelled");
          return;
        }
      }

      // Create safety tag
      const timestamp = new Date().toISOString().replace(/[-:]/g, "").replace(/\..+/, "").replace("T", "-");
      const tagName = `oops/revert-merge-${mergeSha.substring(0, 8)}-${timestamp}`;
      
      logger.info("🛡️  Creating safety tag...");
      await git.exec(["tag", "-a", tagName, "-m", `Safety backup before reverting merge ${mergeSha}`, "HEAD"]);
      logger.success(`✅ Created safety tag: ${tagName}`);

      // Perform the revert
      logger.info(`🔄 Reverting merge commit ${mergeSha}...`);

      try {
        await git.exec(["revert", "-m", mainline.toString(), mergeSha]);
        logger.success("✅ Merge revert completed successfully");
      } catch (error: any) {
        logger.error(`❌ Revert failed: ${error}`);

        // Check if we have conflicts
        try {
          const status = await git.getStatus();
          const conflicted = status.staged.filter(file => 
            file.includes("<<<<<<< HEAD") || 
            file.includes(">>>>>>> ")
          );

          if (conflicted.length > 0) {
            logger.warn(`⚠️  Merge conflicts detected in files:`);
            for (const file of conflicted.slice(0, 10)) {
              logger.warn(`   • ${file}`);
            }

            logger.info("\n🔧 To resolve conflicts:");
            logger.info("   1. Edit the conflicted files to resolve conflicts");
            logger.info("   2. Stage the resolved files: git add <file>");
            logger.info("   3. Complete the revert: git revert --continue");
            logger.info("   4. Or abort: git revert --abort");
          }
        } catch {
          // Ignore status check errors
        }

        logger.info(`\n🛡️  Safety tag created: ${tagName}`);
        logger.info("   Your original state is preserved");
        logger.info(`   To recover: git reset --hard ${tagName}`);

        throw error;
      }

      // Success summary
      logger.success("🎉 Merge revert completed successfully!");

      logger.info("\n📝 Summary:");
      logger.info(`  • Reverted merge: ${mergeSha.substring(0, 8)}`);
      logger.info(`  • Used mainline: ${mainline}`);
      logger.info(`  • Safety tag: ${tagName}`);

      logger.info("\n🚀 Next steps:");
      logger.info("  • Review the revert commit: git show HEAD");
      logger.info("  • Test your application thoroughly");
      logger.info("  • Push when ready: git push");

    } catch (error) {
      logger.error(`Revert-merge operation failed: ${error}`);
      throw error;
    }
  });
