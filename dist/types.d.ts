export interface BaseOptions {
    verbose?: boolean;
    dryRun?: boolean;
    yes?: boolean;
    noColor?: boolean;
}
export interface GitCommit {
    sha: string;
    subject: string;
    author: string;
    date: string;
}
export interface GitStatus {
    staged: string[];
    unstaged: string[];
    untracked: string[];
    branch: string;
    ahead: number;
    behind: number;
}
export interface FileGroup {
    directory: string;
    files: string[];
}
export interface SafetyTag {
    name: string;
    sha: string;
    timestamp: string;
}
export declare class GitOopsError extends Error {
    readonly code: number;
    readonly cause?: Error | undefined;
    constructor(message: string, code?: number, cause?: Error | undefined);
}
export declare class ValidationError extends GitOopsError {
    constructor(message: string);
}
export declare class ExternalToolError extends GitOopsError {
    constructor(message: string, cause?: Error);
}
//# sourceMappingURL=types.d.ts.map