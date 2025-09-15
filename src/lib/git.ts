import { execa } from "execa";
import { ExternalToolError, GitCommit, GitStatus } from "../types.js";
import { Logger } from "../utils.js";

export class Git {
  constructor(
    private logger: Logger,
    private cwd: string = process.cwd()
  ) {}

  // Basic git execution
  async exec(args: string[]): Promise<string> {
    try {
      this.logger.verbose(`git ${args.join(" ")}`);
      const result = await execa("git", args, { cwd: this.cwd });
      return result.stdout;
    } catch (error: any) {
      throw new ExternalToolError(
        `Git command failed: git ${args.join(" ")}\n${error.message}`,
        error
      );
    }
  }

  // Repository status
  async getCurrentBranch(): Promise<string> {
    return (await this.exec(["rev-parse", "--abbrev-ref", "HEAD"])).trim();
  }

  async getStatus(): Promise<GitStatus> {
    const [statusOutput, branchOutput] = await Promise.all([
      this.exec(["status", "--porcelain"]),
      this.exec(["status", "--branch", "--porcelain"]),
    ]);

    const staged: string[] = [];
    const unstaged: string[] = [];
    const untracked: string[] = [];

    for (const line of statusOutput.split("\n")) {
      if (line.trim() === "") continue;

      const status = line.substring(0, 2);
      const file = line.substring(3);

      if (status[0] !== " " && status[0] !== "?") {
        staged.push(file);
      }
      if (status[1] !== " ") {
        unstaged.push(file);
      }
      if (status === "??") {
        untracked.push(file);
      }
    }

    // Parse branch info
    const branchLine = branchOutput.split("\n")[0];
    const branchMatch = branchLine.match(/## ([^.\s]+)/);
    const branch = branchMatch ? branchMatch[1] : "HEAD";

    const aheadMatch = branchLine.match(/ahead (\d+)/);
    const behindMatch = branchLine.match(/behind (\d+)/);
    const ahead = aheadMatch ? parseInt(aheadMatch[1], 10) : 0;
    const behind = behindMatch ? parseInt(behindMatch[1], 10) : 0;

    return { staged, unstaged, untracked, branch, ahead, behind };
  }

  // Get staged files list
  async getStagedFiles(): Promise<string[]> {
    const diff = await this.exec(["diff", "--cached", "--name-only"]);
    return diff
      .split("\n")
      .filter((line) => line.trim() !== "")
      .map((line) => line.trim());
  }

  // Commit operations
  async getCommits(range: string, limit?: number): Promise<GitCommit[]> {
    const args = ["log", "--pretty=format:%H|%s|%an|%ad", "--date=iso"];
    if (limit) {
      args.push(`-${limit}`);
    }
    args.push(range);

    const output = await this.exec(args);
    const commits: GitCommit[] = [];

    for (const line of output.split("\n")) {
      if (line.trim() === "") continue;

      const [sha, subject, author, date] = line.split("|");
      commits.push({ sha, subject, author, date });
    }

    return commits;
  }

  async countCommits(range: string): Promise<number> {
    try {
      const output = await this.exec(["rev-list", "--count", range]);
      return parseInt(output.trim(), 10);
    } catch {
      return 0;
    }
  }

  async commit(message: string): Promise<void> {
    await this.exec(["commit", "-m", message]);
  }

  // Branch operations
  async createBranch(name: string, startPoint?: string): Promise<void> {
    const args = ["checkout", "-b", name];
    if (startPoint) {
      args.push(startPoint);
    }
    await this.exec(args);
  }

  async switchBranch(name: string): Promise<void> {
    await this.exec(["checkout", name]);
  }

  async resetHard(target: string): Promise<void> {
    await this.exec(["reset", "--hard", target]);
  }

  // Upstream operations
  async getUpstream(branch?: string): Promise<string | null> {
    const targetBranch = branch || (await this.getCurrentBranch());

    try {
      const upstream = await this.exec([
        "rev-parse",
        "--abbrev-ref",
        "--symbolic-full-name",
        `${targetBranch}@{u}`,
      ]);
      return upstream.trim();
    } catch {
      // Fallback: check if origin/<branch> exists
      try {
        await this.exec(["rev-parse", "--verify", `origin/${targetBranch}`]);
        return `origin/${targetBranch}`;
      } catch {
        return null;
      }
    }
  }

  // Staging operations
  async stage(files: string[]): Promise<void> {
    if (files.length === 0) return;
    await this.exec(["add", ...files]);
  }

  async unstageAll(): Promise<void> {
    await this.exec(["reset", "HEAD"]);
  }

  // Stash operations
  async stash(message?: string): Promise<string | null> {
    const args = ["stash", "push", "-u"];
    if (message) {
      args.push("-m", message);
    }

    const output = await this.exec(args);

    if (output.includes("No local changes to save")) {
      return null;
    }

    return "stash@{0}";
  }

  async stashPop(): Promise<void> {
    await this.exec(["stash", "pop"]);
  }

  async stashCreate(message?: string): Promise<string | null> {
    const args = ["stash", "create"];
    if (message) {
      args.push(message);
    }

    const output = await this.exec(args);
    return output.trim() || null;
  }

  // Pull operations
  async pull(options: { rebase?: boolean } = {}): Promise<void> {
    const args = ["pull"];
    if (options.rebase) {
      args.push("--rebase");
    }
    await this.exec(args);
  }

  // Ref operations
  async updateRef(ref: string, sha: string): Promise<void> {
    await this.exec(["update-ref", ref, sha]);
  }

  // Remote operations
  async hasRemote(name: string): Promise<boolean> {
    try {
      const output = await this.exec(["remote"]);
      const remotes = output.split("\n").filter((line) => line.trim() !== "");
      return remotes.includes(name);
    } catch {
      return false;
    }
  }
}
