// Basic types for git-oops
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

// Error types
export class GitOopsError extends Error {
  constructor(
    message: string,
    public readonly code: number = 1,
    public readonly cause?: Error
  ) {
    super(message);
    this.name = "GitOopsError";
  }
}

export class ValidationError extends GitOopsError {
  constructor(message: string) {
    super(message, 1);
    this.name = "ValidationError";
  }
}

export class ExternalToolError extends GitOopsError {
  constructor(message: string, cause?: Error) {
    super(message, 2, cause);
    this.name = "ExternalToolError";
  }
}
