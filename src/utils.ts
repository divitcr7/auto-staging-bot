import chalk from 'chalk';
import ora from 'ora';
import inquirer from 'inquirer';
import { BaseOptions } from './types.js';

// Logging utilities
export class Logger {
  constructor(private options: BaseOptions = {}) {}

  info(message: string) {
    if (this.options.noColor) {
      console.log(message);
    } else {
      console.log(chalk.blue('ℹ'), message);
    }
  }

  success(message: string) {
    if (this.options.noColor) {
      console.log(`✓ ${message}`);
    } else {
      console.log(chalk.green('✓'), message);
    }
  }

  warn(message: string) {
    if (this.options.noColor) {
      console.warn(`⚠ ${message}`);
    } else {
      console.warn(chalk.yellow('⚠'), message);
    }
  }

  error(message: string) {
    if (this.options.noColor) {
      console.error(`✗ ${message}`);
    } else {
      console.error(chalk.red('✗'), message);
    }
  }

  verbose(message: string) {
    if (this.options.verbose) {
      if (this.options.noColor) {
        console.log(`[VERBOSE] ${message}`);
      } else {
        console.log(chalk.gray(`[VERBOSE] ${message}`));
      }
    }
  }

  dim(message: string) {
    if (this.options.noColor) {
      console.log(message);
    } else {
      console.log(chalk.dim(message));
    }
  }
}

// Spinner utilities
export function createSpinner(text: string, options: BaseOptions = {}) {
  if (options.json || !process.stdout.isTTY) {
    return {
      start: () => {},
      succeed: (text?: string) => text && console.log(text),
      fail: (text?: string) => text && console.error(text),
      stop: () => {},
    };
  }
  return ora({ text, color: 'blue' });
}

// Prompt utilities
export async function confirm(
  message: string,
  defaultValue = false,
  options: BaseOptions = {}
): Promise<boolean> {
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

export async function select<T extends string>(
  message: string,
  choices: { name: string; value: T }[],
  options: BaseOptions = {}
): Promise<T> {
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
export function formatTimestamp(date = new Date()): string {
  return date
    .toISOString()
    .replace(/[-:]/g, '')
    .replace(/\..+/, '')
    .replace('T', '-');
}

export function formatDate(date = new Date()): string {
  return date.toISOString().split('T')[0];
}

// String utilities
export function sanitizeBranchName(input: string): string {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9\-_.]/g, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/-+/g, '-')
    .slice(0, 50);
}

export function truncateText(text: string, maxLength: number): string {
  if (text.length <= maxLength) {
    return text;
  }
  return text.slice(0, maxLength - 3) + '...';
}

export function pluralize(count: number, singular: string, plural?: string): string {
  if (count === 1) {
    return `${count} ${singular}`;
  }
  return `${count} ${plural || singular + 's'}`;
}

// OS utilities
export function isWindows(): boolean {
  return process.platform === 'win32';
}

export function isMacOS(): boolean {
  return process.platform === 'darwin';
}

export function isLinux(): boolean {
  return process.platform === 'linux';
}

// Path utilities
export function normalizePath(path: string): string {
  return path.replace(/\\/g, '/');
}

export function getTopLevelDirectory(filePath: string): string {
  const normalized = normalizePath(filePath);
  const parts = normalized.split('/');
  
  // If file is in root, return '_root_'
  if (parts.length === 1 || parts[0] === '') {
    return '_root_';
  }
  
  return parts[0];
}

// Size utilities
export function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

export function bytesToKb(bytes: number): number {
  return Math.ceil(bytes / 1024);
}

// Validation utilities
export function isValidSha(sha: string): boolean {
  return /^[a-f0-9]{7,40}$/i.test(sha);
}

export function isValidBranchName(name: string): boolean {
  // Git branch naming rules
  return (
    name.length > 0 &&
    !/^[.\-]/.test(name) &&
    !/[.\-]$/.test(name) &&
    !name.includes('..') &&
    !/[\s~^:?*\[]/.test(name) &&
    !name.includes('@{')
  );
}

export function isProtectedBranch(branchName: string): boolean {
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
