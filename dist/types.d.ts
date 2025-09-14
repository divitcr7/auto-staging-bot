import { z } from 'zod';
export declare const ConfigSchema: z.ZodObject<{
    provider: z.ZodOptional<z.ZodEnum<["openai", "ollama", "anthropic", "azure-openai"]>>;
    model: z.ZodOptional<z.ZodString>;
    maxKb: z.ZodDefault<z.ZodNumber>;
    telemetry: z.ZodDefault<z.ZodBoolean>;
    alwaysIsolate: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
    commitStyle: z.ZodDefault<z.ZodEnum<["conventional", "none"]>>;
}, "strip", z.ZodTypeAny, {
    maxKb: number;
    telemetry: boolean;
    alwaysIsolate: string[];
    commitStyle: "conventional" | "none";
    provider?: "openai" | "ollama" | "anthropic" | "azure-openai" | undefined;
    model?: string | undefined;
}, {
    provider?: "openai" | "ollama" | "anthropic" | "azure-openai" | undefined;
    model?: string | undefined;
    maxKb?: number | undefined;
    telemetry?: boolean | undefined;
    alwaysIsolate?: string[] | undefined;
    commitStyle?: "conventional" | "none" | undefined;
}>;
export type Config = z.infer<typeof ConfigSchema>;
export interface BaseOptions {
    verbose?: boolean;
    dryRun?: boolean;
    yes?: boolean;
    noColor?: boolean;
}
export interface AIOptions extends BaseOptions {
    provider?: string;
    model?: string;
    maxKb?: string;
    apply?: boolean;
    json?: boolean;
    printRedactions?: boolean;
    output?: string;
}
export interface GitCommit {
    sha: string;
    subject: string;
    author: string;
    date: string;
}
export interface GitBranch {
    name: string;
    current: boolean;
    upstream?: string;
}
export interface GitStatus {
    staged: string[];
    unstaged: string[];
    untracked: string[];
    branch: string;
    ahead: number;
    behind: number;
}
export interface LLMProvider {
    name: string;
    generateCompletion(prompt: string, options?: any): Promise<string>;
    isConfigured(): boolean;
}
export interface CommitSuggestion {
    title: string;
    body: string;
}
export interface SplitPlan {
    title: string;
    paths: string[];
}
export interface RiskAssessment {
    level: 'Low' | 'Medium' | 'High';
    reasons: string[];
    blastRadius: string;
    guardrails: string[];
}
export interface ConflictResolution {
    file: string;
    patch: string;
    notes: string[];
}
export declare class GitOopsError extends Error {
    readonly code: number;
    readonly cause?: Error | undefined;
    constructor(message: string, code?: number, cause?: Error | undefined);
}
export declare class ProviderError extends GitOopsError {
    constructor(message: string, cause?: Error);
}
export declare class ValidationError extends GitOopsError {
    constructor(message: string);
}
export declare class ExternalToolError extends GitOopsError {
    constructor(message: string, cause?: Error);
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
//# sourceMappingURL=types.d.ts.map