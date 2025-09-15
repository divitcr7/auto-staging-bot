import { GitCommit, GitStatus } from '../types.js';
import { Logger } from '../utils.js';
export declare class Git {
    private logger;
    private cwd;
    constructor(logger: Logger, cwd?: string);
    exec(args: string[]): Promise<string>;
    getCurrentBranch(): Promise<string>;
    getStatus(): Promise<GitStatus>;
    getStagedFiles(): Promise<string[]>;
    getCommits(range: string, limit?: number): Promise<GitCommit[]>;
    countCommits(range: string): Promise<number>;
    commit(message: string): Promise<void>;
    createBranch(name: string, startPoint?: string): Promise<void>;
    switchBranch(name: string): Promise<void>;
    resetHard(target: string): Promise<void>;
    getUpstream(branch?: string): Promise<string | null>;
    stage(files: string[]): Promise<void>;
    unstageAll(): Promise<void>;
    stash(message?: string): Promise<string | null>;
    stashPop(): Promise<void>;
    stashCreate(message?: string): Promise<string | null>;
    pull(options?: {
        rebase?: boolean;
    }): Promise<void>;
    updateRef(ref: string, sha: string): Promise<void>;
    hasRemote(name: string): Promise<boolean>;
}
//# sourceMappingURL=git.d.ts.map