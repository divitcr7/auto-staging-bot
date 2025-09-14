import { Command } from 'commander';
import { Git } from '../lib/git.js';
import { SafetyManager } from '../lib/safety.js';
import { Logger, confirm, isValidSha } from '../utils.js';
import { BaseOptions, ValidationError } from '../types.js';

interface RevertMergeOptions extends BaseOptions {
  mainline?: string;
  yes?: boolean;
  dryRun?: boolean;
}

export const revertMergeCommand = new Command('revert-merge')
  .description('Safely revert a merge commit with proper safety checks')
  .argument('<merge-sha>', 'SHA of the merge commit to revert')
  .option('-m, --mainline <parent>', 'parent number to revert to (default: 1)', '1')
  .option('--dry-run', 'show what would be done without executing')
  .option('--yes', 'skip confirmation prompts')
  .option('--verbose', 'enable verbose logging')
  .action(async (mergeSha: string, options: RevertMergeOptions, command) => {
    const logger = new Logger(options);
    const git = new Git(logger);
    const safety = new SafetyManager(git, logger);

    try {
      // Validate inputs
      if (!isValidSha(mergeSha)) {
        throw new ValidationError(`Invalid SHA: ${mergeSha}`);
      }

      // Validate repository state
      await safety.validateRepositoryState();
      
      // Ensure working directory is clean
      await safety.validateCleanWorkingDirectory();

      // Validate the commit exists and is accessible
      await safety.validateCommit(mergeSha, 'merge revert');

      logger.info(`🔍 Analyzing merge commit ${mergeSha}...`);

      // Step 1: Verify it's a merge commit
      const isMerge = await git.isMergeCommit(mergeSha);
      if (!isMerge) {
        throw new ValidationError(`Commit ${mergeSha} is not a merge commit`);
      }

      // Step 2: Get merge parents
      const parents = await git.getMergeParents(mergeSha);
      logger.verbose(`Merge parents: ${parents.join(', ')}`);

      if (parents.length < 2) {
        throw new ValidationError(`Merge commit ${mergeSha} has fewer than 2 parents`);
      }

      // Step 3: Validate mainline
      const mainline = parseInt(options.mainline || '1', 10);
      if (isNaN(mainline) || mainline < 1 || mainline > parents.length) {
        throw new ValidationError(
          `Invalid mainline ${options.mainline}. Must be between 1 and ${parents.length}`
        );
      }

      const mainlineParent = parents[mainline - 1];
      const otherParent = parents[mainline === 1 ? 1 : 0];

      logger.info(`📋 Merge commit details:`);
      logger.info(`  • Merge SHA: ${mergeSha}`);
      logger.info(`  • Mainline parent (${mainline}): ${mainlineParent.substring(0, 8)}`);
      logger.info(`  • Other parent: ${otherParent.substring(0, 8)}`);

      // Step 4: Get commit info
      try {
        const commitInfo = await git.exec(['log', '--oneline', '-1', mergeSha]);
        logger.info(`  • Commit: ${commitInfo.trim()}`);
      } catch (error) {
        logger.verbose(`Could not get commit info: ${error}`);
      }

      // Step 5: Check for follow-up commits that might conflict
      const currentBranch = await git.getCurrentBranch();
      const commitsAfterMerge = await git.countCommits(`${mergeSha}..HEAD`);
      
      if (commitsAfterMerge > 0) {
        logger.warn(`⚠️  Found ${commitsAfterMerge} commits after this merge`);
        logger.warn('   This revert might conflict with later changes');
        
        // Show recent commits
        try {
          const recentCommits = await git.getCommits(`${mergeSha}..HEAD`, 5);
          logger.info('\n📝 Recent commits that might conflict:');
          for (const commit of recentCommits) {
            logger.info(`  • ${commit.sha.substring(0, 8)} ${commit.subject}`);
          }
        } catch (error) {
          logger.verbose(`Could not show recent commits: ${error}`);
        }
      }

      // Step 6: Preview the revert
      if (options.dryRun) {
        logger.info('\n📋 Dry run - would perform these actions:');
        logger.info(`1. Create safety tag`);
        logger.info(`2. Revert merge ${mergeSha} with mainline ${mainline}`);
        logger.info(`3. Handle any conflicts`);
        
        // Try to show what would be reverted
        try {
          const diffStat = await git.exec(['diff', '--stat', `${mainlineParent}..${mergeSha}`]);
          if (diffStat.trim()) {
            logger.info('\n📊 Changes that would be reverted:');
            const lines = diffStat.split('\n').slice(0, 10);
            for (const line of lines) {
              if (line.trim()) {
                logger.dim(`   ${line}`);
              }
            }
          }
        } catch (error) {
          logger.verbose(`Could not show diff preview: ${error}`);
        }
        
        return;
      }

      // Step 7: Confirm the operation
      if (!options.yes) {
        logger.info(`\n⚠️  This will revert the merge commit and all its changes`);
        
        const confirmed = await confirm(
          `Revert merge ${mergeSha.substring(0, 8)} with mainline ${mainline}?`,
          false,
          options
        );
        
        if (!confirmed) {
          logger.info('Operation cancelled');
          return;
        }
      }

      // Step 8: Create safety tag
      logger.info('🛡️  Creating safety tag...');
      const safetyTag = await safety.createSafetyTag(`revert-merge-${mergeSha.substring(0, 8)}`);

      // Step 9: Perform the revert
      logger.info(`🔄 Reverting merge commit ${mergeSha}...`);
      
      try {
        await git.revert(mergeSha, { mainline });
        logger.success('✅ Merge revert completed successfully');
      } catch (error: any) {
        logger.error(`❌ Revert failed: ${error}`);
        
        // Check if we have conflicts
        const hasConflicts = await git.hasConflicts();
        
        if (hasConflicts) {
          const conflictedFiles = await git.getConflictedFiles();
          logger.warn(`⚠️  Merge conflicts detected in ${conflictedFiles.length} files:`);
          for (const file of conflictedFiles) {
            logger.warn(`   • ${file}`);
          }
          
          logger.info('\n🔧 To resolve conflicts:');
          logger.info('   1. Edit the conflicted files to resolve conflicts');
          logger.info('   2. Stage the resolved files: git add <file>');
          logger.info('   3. Complete the revert: git revert --continue');
          logger.info('   4. Or abort: git revert --abort');
        }
        
        logger.info(`\n🛡️  Safety tag created: ${safetyTag.name}`);
        logger.info('   Your original state is preserved');
        
        throw error;
      }

      // Step 10: Success summary
      logger.success('🎉 Merge revert completed successfully!');
      
      logger.info('\n📝 Summary:');
      logger.info(`  • Reverted merge: ${mergeSha.substring(0, 8)}`);
      logger.info(`  • Used mainline: ${mainline}`);
      logger.info(`  • Safety tag: ${safetyTag.name}`);

      // Show recovery instructions
      const recoveryInstructions = safety.generateRecoveryInstructions(safetyTag, 'revert-merge');
      logger.info('\n🛡️  Recovery:');
      for (const instruction of recoveryInstructions) {
        logger.dim(`  ${instruction}`);
      }

      // Show next steps
      logger.info('\n🚀 Next steps:');
      logger.info('  • Review the revert commit: git show HEAD');
      logger.info('  • Test your application thoroughly');
      logger.info('  • Push when ready: git push');
      logger.info('  • Consider cherry-picking specific commits if needed');

      // Check current status
      const finalStatus = await git.getStatus();
      if (finalStatus.ahead > 0) {
        logger.info(`\n📤 Your branch is ${finalStatus.ahead} commits ahead`);
      }

    } catch (error) {
      logger.error(`Revert-merge operation failed: ${error}`);
      throw error;
    }
  });
