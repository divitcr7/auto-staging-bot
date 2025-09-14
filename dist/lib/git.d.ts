import { GitCommit, GitBranch, GitStatus } from '../types.js';
import { Logger } from '../utils.js';
export declare class Git {
    private logger;
    private cwd;
    constructor(logger: Logger, cwd?: string);
    exec(args: string[], options?: {
        ignoreExitCode?: boolean;
    }): Promise<string>;
    isGitRepository(): Promise<boolean>;
    getCurrentBranch(): Promise<string>;
    getBranches(): Promise<GitBranch[]>;
    getStatus(): Promise<GitStatus>;
    getCommits(range: string, limit?: number): Promise<GitCommit[]>;
    getLastCommit(): Promise<GitCommit>;
    countCommits(range: string): Promise<number>;
    commit(message: string, options?: {
        amend?: boolean;
    }): Promise<void>;
    createBranch(name: string, startPoint?: string): Promise<void>;
    switchBranch(name: string): Promise<void>;
    resetHard(target: string): Promise<void>;
    getUpstream(branch?: string): Promise<string | null>;
    hasUpstream(branch?: string): Promise<boolean>;
    stage(files: string[]): Promise<void>;
    unstage(files: string[]): Promise<void>;
    unstageAll(): Promise<void>;
    stash(message?: string): Promise<string | null>;
    stashPop(): Promise<void>;
    stashCreate(message?: string): Promise<string | null>;
    pull(options?: {
        rebase?: boolean;
    }): Promise<void>;
    fetch(remote?: string): Promise<void>;
    push(remote?: string, branch?: string, options?: {
        force?: boolean;
    }): Promise<void>;
    createTag(name: string, message?: string, target?: string): Promise<void>;
    deleteTag(name: string): Promise<void>;
    listTags(pattern?: string): Promise<string[]>;
    getStagedDiff(options?: {
        unified?: number;
        nameOnly?: boolean;
    }): Promise<string>;
    getDiff(range?: string, options?: {
        unified?: number;
        nameOnly?: boolean;
    }): Promise<string>;
    updateRef(ref: string, sha: string): Promise<void>;
    deleteRef(ref: string): Promise<void>;
    isMergeCommit(sha: string): Promise<boolean>;
    getMergeParents(sha: string): Promise<string[]>;
    revert(sha: string, options?: {
        mainline?: number;
        noCommit?: boolean;
    }): Promise<void>;
    hasConflicts(): Promise<boolean>;
    getConflictedFiles(): Promise<string[]>;
    getRemotes(): Promise<string[]>;
    hasRemote(name: string): Promise<boolean>;
    validateSha(sha: string): Promise<boolean>;
    shaExists(sha: string): Promise<boolean>;
}
//# sourceMappingURL=git.d.ts.map