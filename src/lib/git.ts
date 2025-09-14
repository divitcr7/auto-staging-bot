import { execa } from 'execa';
import { ExternalToolError, GitCommit, GitBranch, GitStatus } from '../types.js';
import { isValidSha, Logger } from '../utils.js';

export class Git {
  constructor(
    private logger: Logger,
    private cwd: string = process.cwd()
  ) {}

  // Basic git execution
  async exec(args: string[], options: { ignoreExitCode?: boolean } = {}): Promise<string> {
    try {
      this.logger.verbose(`git ${args.join(' ')}`);
      const result = await execa('git', args, {
        cwd: this.cwd,
        reject: !options.ignoreExitCode,
      });
      return result.stdout;
    } catch (error: any) {
      throw new ExternalToolError(
        `Git command failed: git ${args.join(' ')}\n${error.message}`,
        error
      );
    }
  }

  // Repository status
  async isGitRepository(): Promise<boolean> {
    try {
      await this.exec(['rev-parse', '--git-dir']);
      return true;
    } catch {
      return false;
    }
  }

  async getCurrentBranch(): Promise<string> {
    return (await this.exec(['rev-parse', '--abbrev-ref', 'HEAD'])).trim();
  }

  async getBranches(): Promise<GitBranch[]> {
    const output = await this.exec(['branch', '-vv']);
    const branches: GitBranch[] = [];

    for (const line of output.split('\n')) {
      if (line.trim() === '') continue;

      const isCurrent = line.startsWith('*');
      const cleanLine = line.substring(isCurrent ? 2 : 2);
      const parts = cleanLine.trim().split(/\s+/);
      
      if (parts.length >= 2) {
        const name = parts[0];
        const upstreamMatch = cleanLine.match(/\[([^\]]+)\]/);
        const upstream = upstreamMatch ? upstreamMatch[1].split(':')[0] : undefined;

        branches.push({
          name,
          current: isCurrent,
          upstream,
        });
      }
    }

    return branches;
  }

  async getStatus(): Promise<GitStatus> {
    const [statusOutput, branchOutput] = await Promise.all([
      this.exec(['status', '--porcelain']),
      this.exec(['status', '--branch', '--porcelain']),
    ]);

    const staged: string[] = [];
    const unstaged: string[] = [];
    const untracked: string[] = [];

    for (const line of statusOutput.split('\n')) {
      if (line.trim() === '') continue;
      
      const status = line.substring(0, 2);
      const file = line.substring(3);

      if (status[0] !== ' ' && status[0] !== '?') {
        staged.push(file);
      }
      if (status[1] !== ' ') {
        unstaged.push(file);
      }
      if (status === '??') {
        untracked.push(file);
      }
    }

    // Parse branch info
    const branchLine = branchOutput.split('\n')[0];
    const branchMatch = branchLine.match(/## ([^.\s]+)/);
    const branch = branchMatch ? branchMatch[1] : 'HEAD';

    const aheadMatch = branchLine.match(/ahead (\d+)/);
    const behindMatch = branchLine.match(/behind (\d+)/);
    const ahead = aheadMatch ? parseInt(aheadMatch[1], 10) : 0;
    const behind = behindMatch ? parseInt(behindMatch[1], 10) : 0;

    return {
      staged,
      unstaged,
      untracked,
      branch,
      ahead,
      behind,
    };
  }

  // Commit operations
  async getCommits(range: string, limit?: number): Promise<GitCommit[]> {
    const args = ['log', '--pretty=format:%H|%s|%an|%ad', '--date=iso'];
    if (limit) {
      args.push(`-${limit}`);
    }
    args.push(range);

    const output = await this.exec(args);
    const commits: GitCommit[] = [];

    for (const line of output.split('\n')) {
      if (line.trim() === '') continue;
      
      const [sha, subject, author, date] = line.split('|');
      commits.push({ sha, subject, author, date });
    }

    return commits;
  }

  async getLastCommit(): Promise<GitCommit> {
    const commits = await this.getCommits('HEAD', 1);
    if (commits.length === 0) {
      throw new ExternalToolError('No commits found');
    }
    return commits[0];
  }

  async countCommits(range: string): Promise<number> {
    try {
      const output = await this.exec(['rev-list', '--count', range]);
      return parseInt(output.trim(), 10);
    } catch {
      return 0;
    }
  }

  async commit(message: string, options: { amend?: boolean } = {}): Promise<void> {
    const args = ['commit', '-m', message];
    if (options.amend) {
      args.push('--amend');
    }
    await this.exec(args);
  }

  // Branch operations
  async createBranch(name: string, startPoint?: string): Promise<void> {
    const args = ['checkout', '-b', name];
    if (startPoint) {
      args.push(startPoint);
    }
    await this.exec(args);
  }

  async switchBranch(name: string): Promise<void> {
    await this.exec(['checkout', name]);
  }

  async resetHard(target: string): Promise<void> {
    await this.exec(['reset', '--hard', target]);
  }

  // Upstream operations
  async getUpstream(branch?: string): Promise<string | null> {
    const targetBranch = branch || await this.getCurrentBranch();
    
    try {
      // Try to get configured upstream
      const upstream = await this.exec([
        'rev-parse',
        '--abbrev-ref',
        '--symbolic-full-name',
        `${targetBranch}@{u}`,
      ]);
      return upstream.trim();
    } catch {
      // Fallback: check if origin/<branch> exists
      try {
        await this.exec(['rev-parse', '--verify', `origin/${targetBranch}`]);
        return `origin/${targetBranch}`;
      } catch {
        return null;
      }
    }
  }

  async hasUpstream(branch?: string): Promise<boolean> {
    return (await this.getUpstream(branch)) !== null;
  }

  // Staging operations
  async stage(files: string[]): Promise<void> {
    if (files.length === 0) return;
    await this.exec(['add', ...files]);
  }

  async unstage(files: string[]): Promise<void> {
    if (files.length === 0) return;
    await this.exec(['reset', 'HEAD', ...files]);
  }

  async unstageAll(): Promise<void> {
    await this.exec(['reset', 'HEAD']);
  }

  // Stash operations
  async stash(message?: string): Promise<string | null> {
    const args = ['stash', 'push', '-u'];
    if (message) {
      args.push('-m', message);
    }

    const output = await this.exec(args);
    
    // Check if anything was stashed
    if (output.includes('No local changes to save')) {
      return null;
    }

    // Extract stash ID from output
    const stashMatch = output.match(/Saved working directory and index state.*?(\w+)/);
    return stashMatch ? stashMatch[1] : 'stash@{0}';
  }

  async stashPop(): Promise<void> {
    await this.exec(['stash', 'pop']);
  }

  async stashCreate(message?: string): Promise<string | null> {
    const args = ['stash', 'create'];
    if (message) {
      args.push(message);
    }

    const output = await this.exec(args);
    return output.trim() || null;
  }

  // Pull/fetch operations
  async pull(options: { rebase?: boolean } = {}): Promise<void> {
    const args = ['pull'];
    if (options.rebase) {
      args.push('--rebase');
    }
    await this.exec(args);
  }

  async fetch(remote = 'origin'): Promise<void> {
    await this.exec(['fetch', remote]);
  }

  // Push operations
  async push(remote = 'origin', branch?: string, options: { force?: boolean } = {}): Promise<void> {
    const args = ['push'];
    if (options.force) {
      args.push('--force-with-lease');
    }
    args.push(remote);
    if (branch) {
      args.push(branch);
    }
    await this.exec(args);
  }

  // Tag operations
  async createTag(name: string, message?: string, target = 'HEAD'): Promise<void> {
    const args = ['tag'];
    if (message) {
      args.push('-a', name, '-m', message);
    } else {
      args.push(name);
    }
    args.push(target);
    await this.exec(args);
  }

  async deleteTag(name: string): Promise<void> {
    await this.exec(['tag', '-d', name]);
  }

  async listTags(pattern?: string): Promise<string[]> {
    const args = ['tag', '-l'];
    if (pattern) {
      args.push(pattern);
    }
    const output = await this.exec(args);
    return output.split('\n').filter(line => line.trim() !== '');
  }

  // Diff operations
  async getStagedDiff(options: { unified?: number; nameOnly?: boolean } = {}): Promise<string> {
    const args = ['diff', '--cached'];
    if (options.unified !== undefined) {
      args.push(`--unified=${options.unified}`);
    }
    if (options.nameOnly) {
      args.push('--name-only');
    }
    return this.exec(args);
  }

  async getDiff(range?: string, options: { unified?: number; nameOnly?: boolean } = {}): Promise<string> {
    const args = ['diff'];
    if (options.unified !== undefined) {
      args.push(`--unified=${options.unified}`);
    }
    if (options.nameOnly) {
      args.push('--name-only');
    }
    if (range) {
      args.push(range);
    }
    return this.exec(args);
  }

  // Ref operations
  async updateRef(ref: string, sha: string): Promise<void> {
    await this.exec(['update-ref', ref, sha]);
  }

  async deleteRef(ref: string): Promise<void> {
    await this.exec(['update-ref', '-d', ref]);
  }

  // Merge operations
  async isMergeCommit(sha: string): Promise<boolean> {
    if (!isValidSha(sha)) {
      return false;
    }

    try {
      const parents = await this.exec(['rev-list', '--parents', '-n', '1', sha]);
      const parentCount = parents.trim().split(' ').length - 1;
      return parentCount > 1;
    } catch {
      return false;
    }
  }

  async getMergeParents(sha: string): Promise<string[]> {
    const parents = await this.exec(['rev-list', '--parents', '-n', '1', sha]);
    const parts = parents.trim().split(' ');
    return parts.slice(1); // Remove the commit itself, keep only parents
  }

  async revert(sha: string, options: { mainline?: number; noCommit?: boolean } = {}): Promise<void> {
    const args = ['revert'];
    if (options.mainline) {
      args.push('-m', options.mainline.toString());
    }
    if (options.noCommit) {
      args.push('--no-commit');
    }
    args.push(sha);
    await this.exec(args);
  }

  // Conflict resolution
  async hasConflicts(): Promise<boolean> {
    try {
      const status = await this.exec(['status', '--porcelain']);
      return status.includes('UU ') || status.includes('AA ') || status.includes('DD ');
    } catch {
      return false;
    }
  }

  async getConflictedFiles(): Promise<string[]> {
    const status = await this.exec(['status', '--porcelain']);
    const conflicted: string[] = [];

    for (const line of status.split('\n')) {
      if (line.trim() === '') continue;
      
      const statusCode = line.substring(0, 2);
      if (statusCode === 'UU' || statusCode === 'AA' || statusCode === 'DD') {
        conflicted.push(line.substring(3));
      }
    }

    return conflicted;
  }

  // Remote operations
  async getRemotes(): Promise<string[]> {
    const output = await this.exec(['remote']);
    return output.split('\n').filter(line => line.trim() !== '');
  }

  async hasRemote(name: string): Promise<boolean> {
    const remotes = await this.getRemotes();
    return remotes.includes(name);
  }

  // Validation helpers
  async validateSha(sha: string): Promise<boolean> {
    if (!isValidSha(sha)) {
      return false;
    }

    try {
      await this.exec(['rev-parse', '--verify', sha]);
      return true;
    } catch {
      return false;
    }
  }

  async shaExists(sha: string): Promise<boolean> {
    return this.validateSha(sha);
  }
}
