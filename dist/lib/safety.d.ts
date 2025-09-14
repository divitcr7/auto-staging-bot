import { Git } from './git.js';
import { SafetyTag } from '../types.js';
import { Logger } from '../utils.js';
export declare class SafetyManager {
    private git;
    private logger;
    constructor(git: Git, logger: Logger);
    createSafetyTag(context: string, target?: string): Promise<SafetyTag>;
    listSafetyTags(): Promise<SafetyTag[]>;
    cleanupOldSafetyTags(daysToKeep?: number): Promise<number>;
    checkBranchProtection(branchName: string, requireConfirmation?: boolean): Promise<void>;
    checkPushStatus(branchName?: string): Promise<{
        hasUnpushedCommits: boolean;
        commitCount: number;
        upstream: string | null;
    }>;
    warnUnpushedCommits(branchName?: string): Promise<void>;
    generateRecoveryInstructions(safetyTag: SafetyTag, operation: string): string[];
    validateCleanWorkingDirectory(allowStaged?: boolean): Promise<void>;
    validateRepositoryState(): Promise<void>;
    validateUpstream(branchName?: string): Promise<string>;
    validateCommit(sha: string, context?: string): Promise<void>;
    checkForWorkLoss(targetSha: string, currentBranch?: string): Promise<{
        wouldLoseWork: boolean;
        uniqueCommits: number;
        lastCommitSubject?: string;
    }>;
    performPreOperationChecks(options?: {
        requireCleanWorkingDir?: boolean;
        allowStaged?: boolean;
        checkBranchProtection?: boolean;
        checkUpstream?: boolean;
        branchName?: string;
        operation?: string;
    }): Promise<{
        upstream?: string;
        safetyTag?: SafetyTag;
    }>;
}
//# sourceMappingURL=safety.d.ts.map