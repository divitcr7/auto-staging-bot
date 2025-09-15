import { Command } from 'commander';
import { Git } from '../lib/git.js';
import { Logger, formatTimestamp } from '../utils.js';
import { ValidationError } from '../types.js';
export const pocketCommand = new Command('pocket')
    .description('Save exact working state to a hidden ref')
    .option('--push [remote]', 'push the pocket ref to remote (default: origin)')
    .option('--verbose', 'enable verbose logging')
    .action(async (options) => {
    const logger = new Logger(options);
    const git = new Git(logger);
    try {
        const currentBranch = await git.getCurrentBranch();
        const timestamp = formatTimestamp();
        const pocketRef = `refs/pocket/${currentBranch}`;
        logger.info(`💾 Creating pocket save for branch '${currentBranch}'...`);
        // Create a stash of the current state
        logger.verbose('Creating stash of current working state...');
        const stashMessage = `pocket-${timestamp}`;
        let pocketSha;
        try {
            const stashSha = await git.stashCreate(stashMessage);
            if (stashSha) {
                pocketSha = stashSha;
                logger.verbose(`Created stash: ${stashSha}`);
            }
            else {
                // No changes to stash, use HEAD
                pocketSha = await git.exec(['rev-parse', 'HEAD']);
                pocketSha = pocketSha.trim();
                logger.info('📦 No changes detected, saving current commit');
            }
        }
        catch (error) {
            // Fallback to HEAD
            logger.verbose(`Stash creation failed, using HEAD: ${error}`);
            pocketSha = await git.exec(['rev-parse', 'HEAD']);
            pocketSha = pocketSha.trim();
        }
        // Update the pocket ref
        logger.verbose(`Updating pocket ref: ${pocketRef} -> ${pocketSha}`);
        await git.updateRef(pocketRef, pocketSha);
        logger.success(`✅ Saved working state to pocket ref: ${pocketRef}`);
        // Push pocket ref if requested
        if (options.push !== undefined) {
            const remote = typeof options.push === 'string' ? options.push : 'origin';
            if (!(await git.hasRemote(remote))) {
                throw new ValidationError(`Remote '${remote}' does not exist`);
            }
            logger.info(`📤 Pushing pocket ref to remote '${remote}'...`);
            try {
                await git.exec(['push', remote, `${pocketRef}:${pocketRef}`]);
                logger.success(`✅ Pushed pocket ref to '${remote}'`);
                logger.info('\n📋 To access this pocket save from another machine:');
                logger.info(`   git fetch ${remote} ${pocketRef}`);
                logger.info(`   git switch -c pocket/${currentBranch} FETCH_HEAD`);
            }
            catch (error) {
                logger.error(`❌ Failed to push pocket ref: ${error}`);
                logger.info('The pocket save was created locally but not pushed');
            }
        }
        else {
            logger.info('\n📋 To access this pocket save:');
            logger.info(`   git switch -c pocket/${currentBranch} ${pocketRef}`);
        }
        logger.info('\n💡 Note: Hidden refs usually don\'t trigger CI builds');
    }
    catch (error) {
        logger.error(`Pocket operation failed: ${error}`);
        throw error;
    }
});
//# sourceMappingURL=pocket.js.map