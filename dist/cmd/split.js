import { Command } from 'commander';
import { Git } from '../lib/git.js';
import { Logger, pluralize, getTopLevelDirectory } from '../utils.js';
import { ValidationError } from '../types.js';
export const splitCommand = new Command('split')
    .description('Split staged changes into separate commits by top-level directory')
    .option('--dry-run', 'show what would be done without executing')
    .option('--verbose', 'enable verbose logging')
    .action(async (options) => {
    const logger = new Logger(options);
    const git = new Git(logger);
    try {
        // Get staged files
        const stagedFiles = await git.getStagedFiles();
        logger.verbose(`Staged files: ${stagedFiles.length}`);
        if (stagedFiles.length === 0) {
            throw new ValidationError('No staged files found. Stage some files first with: git add <files>');
        }
        // Group files by directory
        const groups = groupFilesByDirectory(stagedFiles);
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
        // Success!
        logger.success(`✅ Successfully created ${pluralize(commitsCreated, 'commit')}`);
        if (commitsCreated > 0) {
            logger.info(`\n🚀 Next steps:`);
            logger.info(`  • Review commits: git log --oneline -${commitsCreated}`);
            logger.info(`  • Push when ready: git push`);
        }
    }
    catch (error) {
        logger.error(`Split operation failed: ${error}`);
        throw error;
    }
});
// Helper function to group files by directory
function groupFilesByDirectory(files) {
    const groups = new Map();
    for (const file of files) {
        const directory = getTopLevelDirectory(file);
        if (!groups.has(directory)) {
            groups.set(directory, []);
        }
        groups.get(directory).push(file);
    }
    // Convert to array and sort by directory name
    const result = [];
    const sortedDirs = Array.from(groups.keys()).sort((a, b) => {
        // _root_ comes last
        if (a === '_root_' && b !== '_root_')
            return 1;
        if (b === '_root_' && a !== '_root_')
            return -1;
        return a.localeCompare(b);
    });
    for (const directory of sortedDirs) {
        result.push({
            directory,
            files: groups.get(directory).sort(),
        });
    }
    return result;
}
//# sourceMappingURL=split.js.map