import { Command } from 'commander';
import { Git } from '../lib/git.js';
import { SafetyManager } from '../lib/safety.js';
import { Logger, formatTimestamp } from '../utils.js';
import { BaseOptions } from '../types.js';

interface YankOptions extends BaseOptions {
  // No specific options for yank
}

export const yankCommand = new Command('yank')
  .description('"Just let me pull" - stash dirty work, pull with rebase, and restore')
  .option('--verbose', 'enable verbose logging')
  .action(async (options: YankOptions, command) => {
    const logger = new Logger(options);
    const git = new Git(logger);
    const safety = new SafetyManager(git, logger);

    try {
      // Validate repository state
      await safety.validateRepositoryState();

      // Check if we have upstream
      const currentBranch = await git.getCurrentBranch();
      const upstream = await git.getUpstream(currentBranch);
      
      if (!upstream) {
        logger.warn(`Branch '${currentBranch}' has no upstream configured`);
        logger.info('Setting up upstream and pulling...');
        
        // Try to pull without upstream (will set tracking)
        try {
          await git.pull();
          logger.success('✅ Pulled successfully');
          return;
        } catch (error) {
          throw new Error(`No upstream configured and unable to pull: ${error}`);
        }
      }

      logger.info(`🎣 Yanking latest changes from ${upstream}...`);

      // Step 1: Check working directory status
      const status = await git.getStatus();
      const hasUnstagedChanges = status.unstaged.length > 0;
      const hasUntrackedFiles = status.untracked.length > 0;
      const hasStagedChanges = status.staged.length > 0;
      const hasDirtyWork = hasUnstagedChanges || hasUntrackedFiles || hasStagedChanges;

      logger.verbose(`Working directory status:`);
      logger.verbose(`  Staged: ${status.staged.length}`);
      logger.verbose(`  Unstaged: ${status.unstaged.length}`);
      logger.verbose(`  Untracked: ${status.untracked.length}`);

      let stashId: string | null = null;

      // Step 2: Stash if needed
      if (hasDirtyWork) {
        const timestamp = formatTimestamp();
        const stashMessage = `oops-yank-${timestamp}`;
        
        logger.info(`💾 Stashing dirty work...`);
        stashId = await git.stash(stashMessage);
        
        if (stashId) {
          logger.success(`✅ Stashed changes as: ${stashMessage}`);
        } else {
          logger.warn('No changes were stashed (working directory was clean)');
        }
      } else {
        logger.info('📁 Working directory is clean, no stashing needed');
      }

      // Step 3: Pull with rebase
      logger.info(`📥 Pulling with rebase from ${upstream}...`);
      
      try {
        await git.pull({ rebase: true });
        logger.success('✅ Pull completed successfully');
      } catch (error) {
        logger.error(`❌ Pull failed: ${error}`);
        
        if (stashId) {
          logger.info('💾 Your stashed changes are safe and can be restored manually');
          logger.info(`   To restore: git stash pop`);
          logger.info(`   To list: git stash list`);
        }
        
        throw error;
      }

      // Step 4: Restore stashed changes
      if (stashId) {
        logger.info(`📤 Restoring stashed changes...`);
        
        try {
          await git.stashPop();
          logger.success('✅ Stashed changes restored successfully');
        } catch (error: any) {
          logger.error(`❌ Failed to restore stashed changes: ${error}`);
          
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
            logger.info('   3. Complete the merge (no commit needed for stash pop)');
            logger.info('   4. Or abort: git reset --hard HEAD && git stash drop');
          } else {
            logger.info('\n🔧 To restore your changes manually:');
            logger.info('   • View stashed changes: git stash show -p');
            logger.info('   • Try again: git stash pop');
            logger.info('   • Or apply without removing: git stash apply');
            logger.info('   • Clean up stash when done: git stash drop');
          }
          
          // Don't throw - we successfully pulled, just failed to restore
          logger.warn('⚠️  Pull succeeded but stash restoration failed');
          logger.info('Your stashed changes are preserved and can be manually restored');
          return;
        }
      }

      // Success!
      logger.success('🎉 Yank operation completed successfully!');
      
      // Show summary
      logger.info('\n📝 Summary:');
      if (stashId) {
        logger.info('  • Stashed dirty work');
      }
      logger.info(`  • Pulled and rebased from ${upstream}`);
      if (stashId) {
        logger.info('  • Restored stashed changes');
      }
      
      // Show current status
      const finalStatus = await git.getStatus();
      if (finalStatus.ahead > 0) {
        logger.info(`\n📤 Your branch is ${finalStatus.ahead} commits ahead of upstream`);
        logger.info('   Consider pushing: git push');
      }
      
      if (finalStatus.staged.length > 0 || finalStatus.unstaged.length > 0) {
        logger.info(`\n📁 Working directory status:`);
        if (finalStatus.staged.length > 0) {
          logger.info(`   • ${finalStatus.staged.length} staged files`);
        }
        if (finalStatus.unstaged.length > 0) {
          logger.info(`   • ${finalStatus.unstaged.length} unstaged files`);
        }
      }

    } catch (error) {
      logger.error(`Yank operation failed: ${error}`);
      throw error;
    }
  });
