import { BaseOptions } from './types.js';
export declare class Logger {
    options: BaseOptions;
    constructor(options?: BaseOptions);
    info(message: string): void;
    success(message: string): void;
    warn(message: string): void;
    error(message: string): void;
    verbose(message: string): void;
    dim(message: string): void;
}
export declare function createSpinner(text: string, options?: BaseOptions & {
    json?: boolean;
}): import("ora").Ora | {
    start: () => void;
    succeed: (text?: string) => void | "" | undefined;
    fail: (text?: string) => void | "" | undefined;
    stop: () => void;
};
export declare function confirm(message: string, defaultValue?: boolean, options?: BaseOptions): Promise<boolean>;
export declare function select<T extends string>(message: string, choices: {
    name: string;
    value: T;
}[], options?: BaseOptions): Promise<T>;
export declare function formatTimestamp(date?: Date): string;
export declare function formatDate(date?: Date): string;
export declare function sanitizeBranchName(input: string): string;
export declare function truncateText(text: string, maxLength: number): string;
export declare function pluralize(count: number, singular: string, plural?: string): string;
export declare function isWindows(): boolean;
export declare function isMacOS(): boolean;
export declare function isLinux(): boolean;
export declare function normalizePath(path: string): string;
export declare function getTopLevelDirectory(filePath: string): string;
export declare function formatBytes(bytes: number): string;
export declare function bytesToKb(bytes: number): number;
export declare function isValidSha(sha: string): boolean;
export declare function isValidBranchName(name: string): boolean;
export declare function isProtectedBranch(branchName: string): boolean;
//# sourceMappingURL=utils.d.ts.map