import chalk from 'chalk';
import inquirer from 'inquirer';
// Simple logging
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
// Utility functions
export function sanitizeBranchName(input) {
    return input
        .toLowerCase()
        .replace(/[^a-z0-9\-]/g, '-')
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
export function getTopLevelDirectory(filePath) {
    const normalized = filePath.replace(/\\/g, '/');
    const parts = normalized.split('/');
    if (parts.length === 1 || parts[0] === '') {
        return '_root_';
    }
    return parts[0];
}
export function formatTimestamp(date = new Date()) {
    return date
        .toISOString()
        .replace(/[-:]/g, '')
        .replace(/\..+/, '')
        .replace('T', '-');
}
export function isValidSha(sha) {
    return /^[a-f0-9]{7,40}$/i.test(sha);
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