import { Logger } from '../utils.js';
export interface RedactionResult {
    content: string;
    redactedFiles: string[];
    redactedPatterns: string[];
    warnings: string[];
}
export declare class RedactionManager {
    private logger;
    constructor(logger: Logger);
    private readonly BLOCKED_FILE_PATTERNS;
    private readonly SECRET_PATTERNS;
    shouldBlockFile(filePath: string): boolean;
    filterFiles(files: string[]): {
        allowed: string[];
        blocked: string[];
    };
    redactContent(content: string, options?: {
        printRedactions?: boolean;
    }): RedactionResult;
    processDiffForAI(diffContent: string, files: string[], options?: {
        maxKb?: number;
        printRedactions?: boolean;
    }): RedactionResult;
    generateRedactionReport(result: RedactionResult): string[];
    validateContentSafety(content: string): {
        isSafe: boolean;
        risks: string[];
        recommendations: string[];
    };
}
//# sourceMappingURL=redact.d.ts.map