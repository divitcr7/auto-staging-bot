import { Command } from 'commander';
import { Git } from '../lib/git.js';
import { DiffManager } from '../lib/diff.js';
import { SafetyManager } from '../lib/safety.js';
import { Logger, pluralize } from '../utils.js';
import { ValidationError } from '../types.js';
export const splitCommand = new Command('split')
    .description('Split staged changes into separate commits by top-level directory')
    .option('--dry-run', 'show what would be done without executing')
    .option('--verbose', 'enable verbose logging')
    .action(async (options, command) => {
    const logger = new Logger(options);
    const git = new Git(logger);
    const diff = new DiffManager(git, logger);
    const safety = new SafetyManager(git, logger);
    try {
        // Validate repository state
        await safety.validateRepositoryState();
        // Get staged files
        const stagedFiles = await diff.getStagedFiles();
        logger.verbose(`Staged files: ${stagedFiles.length}`);
        if (stagedFiles.length === 0) {
            throw new ValidationError('No staged files found. Stage some files first with: git add <files>');
        }
        // Group files by directory
        const groups = diff.groupFilesByDirectory(stagedFiles);
        logger.verbose(`Found ${groups.length} directory groups`);
        if (groups.length <= 1) {
            logger.info('All staged files are in the same directory group - no split needed');
            return;
        }
        // Show the split plan
        logger.info(`📋 Split plan (${pluralize(groups.length, 'commit')}):`);
        for (const group of groups) {
            const dirName = group.directory === '_root_' ? 'root' : group.directory;
            logger.info(`\n📁 ${dirName}/ (${pluralize(group.files.length, 'file')}):`);
            for (const file of group.files.slice(0, 5)) {
                logger.info(`  • ${file}`);
            }
            if (group.files.length > 5) {
                logger.info(`  ... and ${group.files.length - 5} more`);
            }
        }
        if (options.dryRun) {
            logger.info('\n📋 Dry run - would create these commits:');
            for (const group of groups) {
                const dirName = group.directory === '_root_' ? 'root' : group.directory;
                const message = group.directory === '_root_'
                    ? 'chore(root): split from mixed changes'
                    : `chore(${group.directory}): split from mixed changes`;
                logger.info(`  • "${message}"`);
            }
            return;
        }
        // Create safety tag before starting
        const safetyTag = await safety.createSafetyTag('split-before');
        // Perform the split
        logger.info('\n🚀 Splitting staged changes...');
        let commitsCreated = 0;
        for (const group of groups) {
            const dirName = group.directory === '_root_' ? 'root' : group.directory;
            logger.verbose(`Processing group: ${dirName}`);
            // Unstage all files first
            await git.unstageAll();
            // Stage only files for this group
            await git.stage(group.files);
            // Check if there are actually changes to commit
            const status = await git.getStatus();
            if (status.staged.length === 0) {
                logger.warn(`Skipping ${dirName} - no changes after staging`);
                continue;
            }
            // Create commit message
            const message = group.directory === '_root_'
                ? 'chore(root): split from mixed changes'
                : `chore(${group.directory}): split from mixed changes`;
            // Commit the group
            logger.info(`Creating commit for ${dirName}/...`);
            await git.commit(message);
            commitsCreated++;
        }
        // Ensure all files are still staged after split
        await git.stage(stagedFiles);
        const finalStatus = await git.getStatus();
        if (finalStatus.staged.length > 0) {
            logger.warn('Some files remain staged after split - this is unexpected');
            logger.info('Staged files:');
            for (const file of finalStatus.staged) {
                logger.info(`  • ${file}`);
            }
        }
        // Success!
        logger.success(`✅ Successfully created ${pluralize(commitsCreated, 'commit')}`);
        if (commitsCreated > 0) {
            logger.info(`\n📝 Summary:`);
            logger.info(`  • Split into: ${commitsCreated} commits`);
            logger.info(`  • Safety tag: ${safetyTag.name}`);
            // Show recovery instructions
            const recoveryInstructions = safety.generateRecoveryInstructions(safetyTag, 'split');
            logger.info(`\n🛡️  Recovery:`);
            for (const instruction of recoveryInstructions) {
                logger.dim(`  ${instruction}`);
            }
            // Show next steps
            logger.info(`\n🚀 Next steps:`);
            logger.info(`  • Review commits: git log --oneline -${commitsCreated}`);
            logger.info(`  • Push when ready: git push`);
            logger.info(`  • Or combine again: git reset --soft HEAD~${commitsCreated}`);
        }
    }
    catch (error) {
        logger.error(`Split operation failed: ${error}`);
        throw error;
    }
});
//# sourceMappingURL=split.js.map