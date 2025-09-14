import chalk from 'chalk';
import ora from 'ora';
import inquirer from 'inquirer';
// Logging utilities
export class Logger {
    options;
    constructor(options = {}) {
        this.options = options;
    }
    info(message) {
        if (this.options.noColor) {
            console.log(message);
        }
        else {
            console.log(chalk.blue('ℹ'), message);
        }
    }
    success(message) {
        if (this.options.noColor) {
            console.log(`✓ ${message}`);
        }
        else {
            console.log(chalk.green('✓'), message);
        }
    }
    warn(message) {
        if (this.options.noColor) {
            console.warn(`⚠ ${message}`);
        }
        else {
            console.warn(chalk.yellow('⚠'), message);
        }
    }
    error(message) {
        if (this.options.noColor) {
            console.error(`✗ ${message}`);
        }
        else {
            console.error(chalk.red('✗'), message);
        }
    }
    verbose(message) {
        if (this.options.verbose) {
            if (this.options.noColor) {
                console.log(`[VERBOSE] ${message}`);
            }
            else {
                console.log(chalk.gray(`[VERBOSE] ${message}`));
            }
        }
    }
    dim(message) {
        if (this.options.noColor) {
            console.log(message);
        }
        else {
            console.log(chalk.dim(message));
        }
    }
}
// Spinner utilities
export function createSpinner(text, options = {}) {
    if (options.json || !process.stdout.isTTY) {
        return {
            start: () => { },
            succeed: (text) => text && console.log(text),
            fail: (text) => text && console.error(text),
            stop: () => { },
        };
    }
    return ora({ text, color: 'blue' });
}
// Prompt utilities
export async function confirm(message, defaultValue = false, options = {}) {
    if (options.yes) {
        return true;
    }
    const { confirmed } = await inquirer.prompt([
        {
            type: 'confirm',
            name: 'confirmed',
            message,
            default: defaultValue,
        },
    ]);
    return confirmed;
}
export async function select(message, choices, options = {}) {
    if (options.yes && choices.length > 0) {
        return choices[0].value;
    }
    const { selected } = await inquirer.prompt([
        {
            type: 'list',
            name: 'selected',
            message,
            choices,
        },
    ]);
    return selected;
}
// Time utilities
export function formatTimestamp(date = new Date()) {
    return date
        .toISOString()
        .replace(/[-:]/g, '')
        .replace(/\..+/, '')
        .replace('T', '-');
}
export function formatDate(date = new Date()) {
    return date.toISOString().split('T')[0];
}
// String utilities
export function sanitizeBranchName(input) {
    return input
        .toLowerCase()
        .replace(/[^a-z0-9\-_.]/g, '-')
        .replace(/^-+|-+$/g, '')
        .replace(/-+/g, '-')
        .slice(0, 50);
}
export function truncateText(text, maxLength) {
    if (text.length <= maxLength) {
        return text;
    }
    return text.slice(0, maxLength - 3) + '...';
}
export function pluralize(count, singular, plural) {
    if (count === 1) {
        return `${count} ${singular}`;
    }
    return `${count} ${plural || singular + 's'}`;
}
// OS utilities
export function isWindows() {
    return process.platform === 'win32';
}
export function isMacOS() {
    return process.platform === 'darwin';
}
export function isLinux() {
    return process.platform === 'linux';
}
// Path utilities
export function normalizePath(path) {
    return path.replace(/\\/g, '/');
}
export function getTopLevelDirectory(filePath) {
    const normalized = normalizePath(filePath);
    const parts = normalized.split('/');
    // If file is in root, return '_root_'
    if (parts.length === 1 || parts[0] === '') {
        return '_root_';
    }
    return parts[0];
}
// Size utilities
export function formatBytes(bytes) {
    if (bytes === 0)
        return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}
export function bytesToKb(bytes) {
    return Math.ceil(bytes / 1024);
}
// Validation utilities
export function isValidSha(sha) {
    return /^[a-f0-9]{7,40}$/i.test(sha);
}
export function isValidBranchName(name) {
    // Git branch naming rules
    return (name.length > 0 &&
        !/^[.\-]/.test(name) &&
        !/[.\-]$/.test(name) &&
        !name.includes('..') &&
        !/[\s~^:?*\[]/.test(name) &&
        !name.includes('@{'));
}
export function isProtectedBranch(branchName) {
    const protectedPatterns = [
        /^main$/,
        /^master$/,
        /^production$/,
        /^prod$/,
        /^release\/.+/,
        /^hotfix\/.+/,
    ];
    return protectedPatterns.some(pattern => pattern.test(branchName));
}
//# sourceMappingURL=utils.js.map