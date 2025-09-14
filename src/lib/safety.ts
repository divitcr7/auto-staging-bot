import { Git } from './git.js';
import { SafetyTag, ValidationError } from '../types.js';
import { formatTimestamp, Logger, isProtectedBranch } from '../utils.js';

export class SafetyManager {
  constructor(
    private git: Git,
    private logger: Logger
  ) {}

  // Safety tag creation
  async createSafetyTag(context: string, target = 'HEAD'): Promise<SafetyTag> {
    const timestamp = formatTimestamp();
    const tagName = `oops/backup/${context}/${timestamp}`;
    const message = `safety backup by git-oops (${context})`;

    try {
      await this.git.createTag(tagName, message, target);
      
      const tag: SafetyTag = {
        name: tagName,
        sha: await this.git.exec(['rev-parse', target]),
        timestamp,
      };

      this.logger.success(`Created safety tag: ${tagName}`);
      return tag;
    } catch (error) {
      throw new ValidationError(`Failed to create safety tag: ${error}`);
    }
  }

  // List safety tags
  async listSafetyTags(): Promise<SafetyTag[]> {
    const tags = await this.git.listTags('oops/backup/*');
    const safetyTags: SafetyTag[] = [];

    for (const tagName of tags) {
      try {
        const sha = await this.git.exec(['rev-parse', tagName]);
        const timestampMatch = tagName.match(/(\d{8}-\d{6})$/);
        const timestamp = timestampMatch ? timestampMatch[1] : '';

        safetyTags.push({
          name: tagName,
          sha: sha.trim(),
          timestamp,
        });
      } catch {
        // Skip invalid tags
        continue;
      }
    }

    return safetyTags.sort((a, b) => b.timestamp.localeCompare(a.timestamp));
  }

  // Cleanup old safety tags
  async cleanupOldSafetyTags(daysToKeep = 30): Promise<number> {
    const allTags = await this.listSafetyTags();
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);
    const cutoffTimestamp = formatTimestamp(cutoffDate).split('-')[0]; // YYYYMMDD

    let deletedCount = 0;

    for (const tag of allTags) {
      const tagDate = tag.timestamp.split('-')[0]; // YYYYMMDD
      if (tagDate < cutoffTimestamp) {
        try {
          await this.git.deleteTag(tag.name);
          this.logger.verbose(`Deleted old safety tag: ${tag.name}`);
          deletedCount++;
        } catch (error) {
          this.logger.warn(`Failed to delete safety tag ${tag.name}: ${error}`);
        }
      }
    }

    if (deletedCount > 0) {
      this.logger.info(`Cleaned up ${deletedCount} old safety tags`);
    }

    return deletedCount;
  }

  // Branch protection checks
  async checkBranchProtection(branchName: string, requireConfirmation = true): Promise<void> {
    if (isProtectedBranch(branchName)) {
      const message = `Branch '${branchName}' appears to be protected. This operation could be risky.`;
      this.logger.warn(message);
      
      if (requireConfirmation) {
        throw new ValidationError(
          `${message} Use --yes to proceed anyway.`
        );
      }
    }
  }

  // Push status checks
  async checkPushStatus(branchName?: string): Promise<{
    hasUnpushedCommits: boolean;
    commitCount: number;
    upstream: string | null;
  }> {
    const currentBranch = branchName || await this.git.getCurrentBranch();
    const upstream = await this.git.getUpstream(currentBranch);
    
    if (!upstream) {
      return {
        hasUnpushedCommits: false,
        commitCount: 0,
        upstream: null,
      };
    }

    const commitCount = await this.git.countCommits(`${upstream}..HEAD`);
    
    return {
      hasUnpushedCommits: commitCount > 0,
      commitCount,
      upstream,
    };
  }

  // Warn about unpushed commits
  async warnUnpushedCommits(branchName?: string): Promise<void> {
    const pushStatus = await this.checkPushStatus(branchName);
    
    if (pushStatus.hasUnpushedCommits) {
      this.logger.warn(
        `Branch has ${pushStatus.commitCount} unpushed commits. ` +
        `You may need to force-push after this operation.`
      );
    }
  }

  // Recovery instructions
  generateRecoveryInstructions(safetyTag: SafetyTag, operation: string): string[] {
    return [
      `To recover from ${operation}:`,
      '',
      `1. Check the safety tag: git show ${safetyTag.name}`,
      `2. Create recovery branch: git checkout -b recovery-${safetyTag.timestamp} ${safetyTag.name}`,
      `3. Or reset current branch: git reset --hard ${safetyTag.name}`,
      '',
      `Safety tag will be automatically cleaned up after 30 days.`,
      `To clean up manually: git tag -d ${safetyTag.name}`,
    ];
  }

  // Validate preconditions for operations
  async validateCleanWorkingDirectory(allowStaged = false): Promise<void> {
    const status = await this.git.getStatus();
    
    const hasUnstaged = status.unstaged.length > 0;
    const hasUntracked = status.untracked.length > 0;
    const hasStaged = status.staged.length > 0;

    if (hasUnstaged || hasUntracked) {
      throw new ValidationError(
        'Working directory is not clean. Please commit or stash your changes first.'
      );
    }

    if (hasStaged && !allowStaged) {
      throw new ValidationError(
        'There are staged changes. Please commit or unstage them first.'
      );
    }
  }

  async validateRepositoryState(): Promise<void> {
    if (!(await this.git.isGitRepository())) {
      throw new ValidationError('Not a git repository');
    }

    // Check if we're in the middle of a merge, rebase, etc.
    try {
      await this.git.exec(['rev-parse', '--verify', 'MERGE_HEAD']);
      throw new ValidationError('Merge in progress. Please complete or abort the merge first.');
    } catch {
      // No merge in progress, which is good
    }

    try {
      await this.git.exec(['rev-parse', '--verify', 'REBASE_HEAD']);
      throw new ValidationError('Rebase in progress. Please complete or abort the rebase first.');
    } catch {
      // No rebase in progress, which is good
    }
  }

  // Upstream validation
  async validateUpstream(branchName?: string): Promise<string> {
    const currentBranch = branchName || await this.git.getCurrentBranch();
    const upstream = await this.git.getUpstream(currentBranch);
    
    if (!upstream) {
      throw new ValidationError(
        `Branch '${currentBranch}' has no upstream. ` +
        `Set upstream with: git push -u origin ${currentBranch}`
      );
    }

    // Verify upstream exists
    try {
      await this.git.exec(['rev-parse', '--verify', upstream]);
    } catch {
      throw new ValidationError(
        `Upstream '${upstream}' does not exist. Please fetch or set a valid upstream.`
      );
    }

    return upstream;
  }

  // Validate commit exists and is accessible
  async validateCommit(sha: string, context?: string): Promise<void> {
    if (!await this.git.validateSha(sha)) {
      const message = context 
        ? `Invalid commit for ${context}: ${sha}`
        : `Invalid commit: ${sha}`;
      throw new ValidationError(message);
    }
  }

  // Check if operation would lose work
  async checkForWorkLoss(targetSha: string, currentBranch?: string): Promise<{
    wouldLoseWork: boolean;
    uniqueCommits: number;
    lastCommitSubject?: string;
  }> {
    const branch = currentBranch || await this.git.getCurrentBranch();
    const currentSha = await this.git.exec(['rev-parse', 'HEAD']);
    
    if (currentSha.trim() === targetSha) {
      return {
        wouldLoseWork: false,
        uniqueCommits: 0,
      };
    }

    // Check commits that would be lost
    try {
      const uniqueCommits = await this.git.countCommits(`${targetSha}..HEAD`);
      let lastCommitSubject: string | undefined;
      
      if (uniqueCommits > 0) {
        const lastCommit = await this.git.getLastCommit();
        lastCommitSubject = lastCommit.subject;
      }

      return {
        wouldLoseWork: uniqueCommits > 0,
        uniqueCommits,
        lastCommitSubject,
      };
    } catch {
      // If we can't determine, assume we would lose work
      return {
        wouldLoseWork: true,
        uniqueCommits: 1,
      };
    }
  }

  // Pre-operation safety checks
  async performPreOperationChecks(options: {
    requireCleanWorkingDir?: boolean;
    allowStaged?: boolean;
    checkBranchProtection?: boolean;
    checkUpstream?: boolean;
    branchName?: string;
    operation?: string;
  } = {}): Promise<{
    upstream?: string;
    safetyTag?: SafetyTag;
  }> {
    const {
      requireCleanWorkingDir = true,
      allowStaged = false,
      checkBranchProtection = true,
      checkUpstream = false,
      branchName,
      operation = 'operation',
    } = options;

    // Basic repository validation
    await this.validateRepositoryState();

    // Check working directory
    if (requireCleanWorkingDir) {
      await this.validateCleanWorkingDirectory(allowStaged);
    }

    // Check branch protection
    if (checkBranchProtection) {
      const branch = branchName || await this.git.getCurrentBranch();
      await this.checkBranchProtection(branch, false);
    }

    // Check upstream if required
    let upstream: string | undefined;
    if (checkUpstream) {
      upstream = await this.validateUpstream(branchName);
    }

    // Create safety tag
    const safetyTag = await this.createSafetyTag(operation);

    return {
      upstream,
      safetyTag,
    };
  }
}
