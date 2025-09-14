import { Command } from 'commander';
import { Git } from '../lib/git.js';
import { SafetyManager } from '../lib/safety.js';
import { Logger, confirm, sanitizeBranchName, truncateText, pluralize } from '../utils.js';
import { BaseOptions, ValidationError } from '../types.js';

interface WrongBranchOptions extends BaseOptions {
  yes?: boolean;
}

export const wrongBranchCommand = new Command('wrong-branch')
  .description('Move commits from current branch to a new branch and reset current branch to upstream')
  .argument('[new-branch]', 'name of the new branch to create (optional)')
  .option('--dry-run', 'show what would be done without executing')
  .option('--yes', 'skip confirmation prompts')
  .option('--verbose', 'enable verbose logging')
  .action(async (newBranchName: string | undefined, options: WrongBranchOptions, command) => {
    const logger = new Logger(options);
    const git = new Git(logger);
    const safety = new SafetyManager(git, logger);

    try {
      // Validate repository state
      await safety.validateRepositoryState();
      
      // Get current branch
      const currentBranch = await git.getCurrentBranch();
      logger.verbose(`Current branch: ${currentBranch}`);

      // Check if current branch is protected
      await safety.checkBranchProtection(currentBranch, !options.yes);

      // Get upstream
      const upstream = await safety.validateUpstream(currentBranch);
      logger.verbose(`Upstream: ${upstream}`);

      // Count unique commits
      const uniqueCommits = await git.countCommits(`${upstream}..HEAD`);
      logger.verbose(`Unique commits: ${uniqueCommits}`);

      if (uniqueCommits === 0) {
        logger.success('Nothing to move - current branch is already up to date with upstream');
        return;
      }

      // Get commits to move
      const commits = await git.getCommits(`${upstream}..HEAD`);
      logger.info(`Found ${pluralize(uniqueCommits, 'commit')} to move:`);
      
      for (const commit of commits.slice(0, 5)) {
        logger.info(`  ${commit.sha.substring(0, 8)} ${truncateText(commit.subject, 60)}`);
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

      // Check if target branch already exists
      try {
        await git.exec(['rev-parse', '--verify', targetBranch]);
        throw new ValidationError(`Branch '${targetBranch}' already exists`);
      } catch (error: any) {
        if (!error.message.includes('unknown revision')) {
          throw error;
        }
        // Branch doesn't exist, which is what we want
      }

      // Warn about unpushed commits
      await safety.warnUnpushedCommits(currentBranch);

      if (options.dryRun) {
        logger.info('\n📋 Dry run - would perform these actions:');
        logger.info(`1. Create safety tag for current state`);
        logger.info(`2. Create branch '${targetBranch}' at current HEAD`);
        logger.info(`3. Switch back to '${currentBranch}'`);
        logger.info(`4. Reset '${currentBranch}' to '${upstream}'`);
        logger.info(`5. Switch to '${targetBranch}'`);
        return;
      }

      // Confirm operation
      if (!options.yes) {
        const confirmed = await confirm(
          `Move ${pluralize(uniqueCommits, 'commit')} from '${currentBranch}' to new branch '${targetBranch}'?`,
          false,
          options
        );
        
        if (!confirmed) {
          logger.info('Operation cancelled');
          return;
        }
      }

      // Perform the operation
      logger.info('🚀 Starting wrong-branch operation...');

      // 1. Create safety tag
      const safetyTag = await safety.createSafetyTag(`wrong-branch-${currentBranch}`);
      
      // 2. Create new branch at current HEAD
      logger.info(`Creating branch '${targetBranch}'...`);
      await git.createBranch(targetBranch);
      
      // 3. Switch back to original branch
      logger.verbose(`Switching back to '${currentBranch}'...`);
      await git.switchBranch(currentBranch);
      
      // 4. Reset to upstream
      logger.info(`Resetting '${currentBranch}' to '${upstream}'...`);
      await git.resetHard(upstream);
      
      // 5. Switch to new branch
      logger.verbose(`Switching to '${targetBranch}'...`);
      await git.switchBranch(targetBranch);

      // Success!
      logger.success(`✅ Successfully moved ${pluralize(uniqueCommits, 'commit')} to '${targetBranch}'`);
      logger.info(`\n📝 Summary:`);
      logger.info(`  • Created branch: ${targetBranch}`);
      logger.info(`  • Reset ${currentBranch} to: ${upstream}`);
      logger.info(`  • Currently on: ${targetBranch}`);
      logger.info(`  • Safety tag: ${safetyTag.name}`);

      // Show recovery instructions
      const recoveryInstructions = safety.generateRecoveryInstructions(safetyTag, 'wrong-branch');
      logger.info(`\n🛡️  Recovery:`);
      for (const instruction of recoveryInstructions) {
        logger.dim(`  ${instruction}`);
      }

      // Show next steps
      logger.info(`\n🚀 Next steps:`);
      logger.info(`  • Review your commits on '${targetBranch}'`);
      logger.info(`  • Push when ready: git push -u origin ${targetBranch}`);
      logger.info(`  • Switch back anytime: git checkout ${currentBranch}`);

    } catch (error) {
      logger.error(`Wrong-branch operation failed: ${error}`);
      throw error;
    }
  });
