import { Command } from 'commander';
import { Git } from '../lib/git.js';
import { SafetyManager } from '../lib/safety.js';
import { Logger, formatTimestamp } from '../utils.js';
import { BaseOptions, ValidationError } from '../types.js';

interface PocketOptions extends BaseOptions {
  push?: string | boolean;
}

export const pocketCommand = new Command('pocket')
  .description('Save exact working state (including unstaged) to a hidden ref')
  .option('--push [remote]', 'push the pocket ref to remote (default: origin)')
  .option('--verbose', 'enable verbose logging')
  .action(async (options: PocketOptions, command) => {
    const logger = new Logger(options);
    const git = new Git(logger);
    const safety = new SafetyManager(git, logger);

    try {
      // Validate repository state
      await safety.validateRepositoryState();

      const currentBranch = await git.getCurrentBranch();
      const timestamp = formatTimestamp();
      const pocketRef = `refs/pocket/${currentBranch}`;

      logger.info(`💾 Creating pocket save for branch '${currentBranch}'...`);

      // Step 1: Try to create a stash of the current state
      logger.verbose('Creating stash of current working state...');
      const stashMessage = `pocket-${timestamp}`;
      let pocketSha: string;

      try {
        const stashSha = await git.stashCreate(stashMessage);
        
        if (stashSha) {
          // We have changes to stash
          pocketSha = stashSha;
          logger.verbose(`Created stash: ${stashSha}`);
          
          // Check what we captured
          const status = await git.getStatus();
          const totalFiles = status.staged.length + status.unstaged.length + status.untracked.length;
          
          if (totalFiles > 0) {
            logger.info(`📦 Captured ${totalFiles} changed files`);
          }
        } else {
          // No changes to stash, use HEAD
          pocketSha = await git.exec(['rev-parse', 'HEAD']);
          pocketSha = pocketSha.trim();
          logger.info('📦 No changes detected, saving current commit');
        }
      } catch (error) {
        // Fallback to HEAD if stash creation fails
        logger.verbose(`Stash creation failed, using HEAD: ${error}`);
        pocketSha = await git.exec(['rev-parse', 'HEAD']);
        pocketSha = pocketSha.trim();
      }

      // Step 2: Update the pocket ref
      logger.verbose(`Updating pocket ref: ${pocketRef} -> ${pocketSha}`);
      await git.updateRef(pocketRef, pocketSha);
      
      logger.success(`✅ Saved working state to pocket ref: ${pocketRef}`);

      // Step 3: Push pocket ref if requested
      if (options.push !== undefined) {
        const remote = typeof options.push === 'string' ? options.push : 'origin';
        
        // Check if remote exists
        if (!(await git.hasRemote(remote))) {
          throw new ValidationError(`Remote '${remote}' does not exist`);
        }

        logger.info(`📤 Pushing pocket ref to remote '${remote}'...`);
        
        try {
          // Push the pocket ref
          await git.exec(['push', remote, `${pocketRef}:${pocketRef}`]);
          logger.success(`✅ Pushed pocket ref to '${remote}'`);
          
          // Provide fetch instructions
          logger.info('\n📋 To access this pocket save from another machine:');
          logger.info(`   git fetch ${remote} ${pocketRef}`);
          logger.info(`   git switch -c pocket/${currentBranch} FETCH_HEAD`);
          
        } catch (error) {
          logger.error(`❌ Failed to push pocket ref: ${error}`);
          logger.info('The pocket save was created locally but not pushed');
        }
      } else {
        // Show local access instructions
        logger.info('\n📋 To access this pocket save:');
        logger.info(`   git switch -c pocket/${currentBranch} ${pocketRef}`);
        logger.info('   Or view contents: git show ' + pocketRef);
      }

      // Step 4: Show what was saved
      try {
        // Get short summary of what was saved
        const commitInfo = await git.exec(['log', '--oneline', '-1', pocketSha]);
        logger.info(`\n📝 Pocket contents: ${commitInfo.trim()}`);
        
        // If this was a stash, show what files were included
        if (pocketSha !== await git.exec(['rev-parse', 'HEAD'])) {
          try {
            const diffStat = await git.exec(['diff', '--stat', `${pocketSha}^`, pocketSha]);
            if (diffStat.trim()) {
              logger.info('\n📊 Changes captured:');
              const lines = diffStat.split('\n').slice(0, 10); // Show first 10 lines
              for (const line of lines) {
                if (line.trim()) {
                  logger.dim(`   ${line}`);
                }
              }
            }
          } catch {
            // Ignore diff errors for stash objects
          }
        }
      } catch (error) {
        logger.verbose(`Could not show pocket contents: ${error}`);
      }

      // Step 5: Show management info
      logger.info('\n🔧 Pocket management:');
      logger.info(`   • View all pockets: git for-each-ref refs/pocket/`);
      logger.info(`   • Delete this pocket: git update-ref -d ${pocketRef}`);
      logger.info(`   • Show diff: git diff ${pocketSha}`);
      
      if (options.push !== undefined) {
        const remote = typeof options.push === 'string' ? options.push : 'origin';
        logger.info(`   • Delete remote pocket: git push ${remote} :${pocketRef}`);
      }

      // Note about CI
      logger.info('\n💡 Note: Hidden refs usually don\'t trigger CI builds');

    } catch (error) {
      logger.error(`Pocket operation failed: ${error}`);
      throw error;
    }
  });
