import { z } from 'zod';

// Configuration schema
export const ConfigSchema = z.object({
  provider: z
    .enum(['openai', 'ollama', 'anthropic', 'azure-openai'])
    .optional(),
  model: z.string().optional(),
  maxKb: z.number().default(96),
  telemetry: z.boolean().default(false),
  alwaysIsolate: z.array(z.string()).default([]),
  commitStyle: z.enum(['conventional', 'none']).default('conventional'),
});

export type Config = z.infer<typeof ConfigSchema>;

// Command options
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

// Git types
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

// AI types
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

// Error types
export class GitOopsError extends Error {
  constructor(
    message: string,
    public readonly code: number = 1,
    public readonly cause?: Error
  ) {
    super(message);
    this.name = 'GitOopsError';
  }
}

export class ProviderError extends GitOopsError {
  constructor(message: string, cause?: Error) {
    super(message, 3, cause);
    this.name = 'ProviderError';
  }
}

export class ValidationError extends GitOopsError {
  constructor(message: string) {
    super(message, 1);
    this.name = 'ValidationError';
  }
}

export class ExternalToolError extends GitOopsError {
  constructor(message: string, cause?: Error) {
    super(message, 2, cause);
    this.name = 'ExternalToolError';
  }
}

// Utility types
export interface FileGroup {
  directory: string;
  files: string[];
}

export interface SafetyTag {
  name: string;
  sha: string;
  timestamp: string;
}
