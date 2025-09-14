import { Git } from './git.js';
import { FileGroup } from '../types.js';
import { Logger } from '../utils.js';
export declare class DiffManager {
    private git;
    private logger;
    constructor(git: Git, logger: Logger);
    getStagedFiles(): Promise<string[]>;
    groupFilesByDirectory(files: string[]): FileGroup[];
    getStagedDiffContent(options?: {
        maxKb?: number;
        unified?: number;
        includeContext?: boolean;
    }): Promise<{
        content: string;
        size: number;
        truncated: boolean;
    }>;
    getDiffForFiles(files: string[], options?: {
        staged?: boolean;
        unified?: number;
    }): Promise<string>;
    applyPatch(patchContent: string, options?: {
        threeWay?: boolean;
        check?: boolean;
    }): Promise<{
        success: boolean;
        conflicts: string[];
        errors: string[];
    }>;
    getChangeContext(file: string, lineNumber: number, contextLines?: number): Promise<{
        before: string[];
        change: string;
        after: string[];
    }>;
    getRepositoryContext(): Promise<{
        languages: string[];
        frameworks: string[];
        fileCount: number;
    }>;
    validateDiffForSafety(diffContent: string): {
        isSecure: boolean;
        warnings: string[];
        blockedPatterns: string[];
    };
}
//# sourceMappingURL=diff.d.ts.map