import { Command } from 'commander';
import { Git } from '../lib/git.js';
import { Logger, formatTimestamp } from '../utils.js';
export const yankCommand = new Command('yank')
    .description('"Just let me pull" - stash dirty work, pull with rebase, and restore')
    .option('--verbose', 'enable verbose logging')
    .action(async (options) => {
    const logger = new Logger(options);
    const git = new Git(logger);
    try {
        // Check if we have upstream
        const currentBranch = await git.getCurrentBranch();
        const upstream = await git.getUpstream(currentBranch);
        if (!upstream) {
            logger.warn(`Branch '${currentBranch}' has no upstream configured`);
            logger.info('Trying to pull anyway...');
            try {
                await git.pull();
                logger.success('✅ Pulled successfully');
                return;
            }
            catch (error) {
                throw new Error(`No upstream configured and unable to pull: ${error}`);
            }
        }
        logger.info(`🎣 Yanking latest changes from ${upstream}...`);
        // Check working directory status
        const status = await git.getStatus();
        const hasDirtyWork = status.unstaged.length > 0 || status.untracked.length > 0 || status.staged.length > 0;
        logger.verbose(`Working directory status:`);
        logger.verbose(`  Staged: ${status.staged.length}`);
        logger.verbose(`  Unstaged: ${status.unstaged.length}`);
        logger.verbose(`  Untracked: ${status.untracked.length}`);
        let stashId = null;
        // Stash if needed
        if (hasDirtyWork) {
            const timestamp = formatTimestamp();
            const stashMessage = `oops-yank-${timestamp}`;
            logger.info(`💾 Stashing dirty work...`);
            stashId = await git.stash(stashMessage);
            if (stashId) {
                logger.success(`✅ Stashed changes as: ${stashMessage}`);
            }
        }
        else {
            logger.info('📁 Working directory is clean, no stashing needed');
        }
        // Pull with rebase
        logger.info(`📥 Pulling with rebase from ${upstream}...`);
        try {
            await git.pull({ rebase: true });
            logger.success('✅ Pull completed successfully');
        }
        catch (error) {
            logger.error(`❌ Pull failed: ${error}`);
            if (stashId) {
                logger.info('💾 Your stashed changes are safe');
                logger.info(`   To restore: git stash pop`);
            }
            throw error;
        }
        // Restore stashed changes
        if (stashId) {
            logger.info(`📤 Restoring stashed changes...`);
            try {
                await git.stashPop();
                logger.success('✅ Stashed changes restored successfully');
            }
            catch (error) {
                logger.error(`❌ Failed to restore stashed changes: ${error}`);
                logger.info('\n🔧 To restore your changes manually:');
                logger.info('   • Try again: git stash pop');
                logger.info('   • Or view stash: git stash show -p');
                logger.warn('⚠️  Pull succeeded but stash restoration failed');
                return;
            }
        }
        // Success!
        logger.success('🎉 Yank operation completed successfully!');
    }
    catch (error) {
        logger.error(`Yank operation failed: ${error}`);
        throw error;
    }
});
//# sourceMappingURL=yank.js.map