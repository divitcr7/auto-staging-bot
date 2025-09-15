import { execa } from 'execa';
import { ExternalToolError } from '../types.js';
export class Git {
    logger;
    cwd;
    constructor(logger, cwd = process.cwd()) {
        this.logger = logger;
        this.cwd = cwd;
    }
    // Basic git execution
    async exec(args) {
        try {
            this.logger.verbose(`git ${args.join(' ')}`);
            const result = await execa('git', args, { cwd: this.cwd });
            return result.stdout;
        }
        catch (error) {
            throw new ExternalToolError(`Git command failed: git ${args.join(' ')}\n${error.message}`, error);
        }
    }
    // Repository status
    async getCurrentBranch() {
        return (await this.exec(['rev-parse', '--abbrev-ref', 'HEAD'])).trim();
    }
    async getStatus() {
        const [statusOutput, branchOutput] = await Promise.all([
            this.exec(['status', '--porcelain']),
            this.exec(['status', '--branch', '--porcelain']),
        ]);
        const staged = [];
        const unstaged = [];
        const untracked = [];
        for (const line of statusOutput.split('\n')) {
            if (line.trim() === '')
                continue;
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
        return { staged, unstaged, untracked, branch, ahead, behind };
    }
    // Get staged files list
    async getStagedFiles() {
        const diff = await this.exec(['diff', '--cached', '--name-only']);
        return diff
            .split('\n')
            .filter(line => line.trim() !== '')
            .map(line => line.trim());
    }
    // Commit operations
    async getCommits(range, limit) {
        const args = ['log', '--pretty=format:%H|%s|%an|%ad', '--date=iso'];
        if (limit) {
            args.push(`-${limit}`);
        }
        args.push(range);
        const output = await this.exec(args);
        const commits = [];
        for (const line of output.split('\n')) {
            if (line.trim() === '')
                continue;
            const [sha, subject, author, date] = line.split('|');
            commits.push({ sha, subject, author, date });
        }
        return commits;
    }
    async countCommits(range) {
        try {
            const output = await this.exec(['rev-list', '--count', range]);
            return parseInt(output.trim(), 10);
        }
        catch {
            return 0;
        }
    }
    async commit(message) {
        await this.exec(['commit', '-m', message]);
    }
    // Branch operations
    async createBranch(name, startPoint) {
        const args = ['checkout', '-b', name];
        if (startPoint) {
            args.push(startPoint);
        }
        await this.exec(args);
    }
    async switchBranch(name) {
        await this.exec(['checkout', name]);
    }
    async resetHard(target) {
        await this.exec(['reset', '--hard', target]);
    }
    // Upstream operations
    async getUpstream(branch) {
        const targetBranch = branch || await this.getCurrentBranch();
        try {
            const upstream = await this.exec([
                'rev-parse',
                '--abbrev-ref',
                '--symbolic-full-name',
                `${targetBranch}@{u}`,
            ]);
            return upstream.trim();
        }
        catch {
            // Fallback: check if origin/<branch> exists
            try {
                await this.exec(['rev-parse', '--verify', `origin/${targetBranch}`]);
                return `origin/${targetBranch}`;
            }
            catch {
                return null;
            }
        }
    }
    // Staging operations
    async stage(files) {
        if (files.length === 0)
            return;
        await this.exec(['add', ...files]);
    }
    async unstageAll() {
        await this.exec(['reset', 'HEAD']);
    }
    // Stash operations
    async stash(message) {
        const args = ['stash', 'push', '-u'];
        if (message) {
            args.push('-m', message);
        }
        const output = await this.exec(args);
        if (output.includes('No local changes to save')) {
            return null;
        }
        return 'stash@{0}';
    }
    async stashPop() {
        await this.exec(['stash', 'pop']);
    }
    async stashCreate(message) {
        const args = ['stash', 'create'];
        if (message) {
            args.push(message);
        }
        const output = await this.exec(args);
        return output.trim() || null;
    }
    // Pull operations
    async pull(options = {}) {
        const args = ['pull'];
        if (options.rebase) {
            args.push('--rebase');
        }
        await this.exec(args);
    }
    // Ref operations
    async updateRef(ref, sha) {
        await this.exec(['update-ref', ref, sha]);
    }
    // Remote operations
    async hasRemote(name) {
        try {
            const output = await this.exec(['remote']);
            const remotes = output.split('\n').filter(line => line.trim() !== '');
            return remotes.includes(name);
        }
        catch {
            return false;
        }
    }
}
//# sourceMappingURL=git.js.map