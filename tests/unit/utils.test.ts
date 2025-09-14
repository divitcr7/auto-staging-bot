import { describe, it, expect } from 'vitest';
import {
  sanitizeBranchName,
  truncateText,
  pluralize,
  getTopLevelDirectory,
  isValidSha,
  isValidBranchName,
  isProtectedBranch,
  formatBytes,
  bytesToKb,
} from '../../src/utils.js';

describe('utils', () => {
  describe('sanitizeBranchName', () => {
    it('should sanitize invalid characters', () => {
      expect(sanitizeBranchName('feat/add user@domain.com')).toBe('feat-add-user-domain-com');
      expect(sanitizeBranchName('Fix Bug #123')).toBe('fix-bug-123');
    });

    it('should handle edge cases', () => {
      expect(sanitizeBranchName('---start')).toBe('start');
      expect(sanitizeBranchName('end---')).toBe('end');
      expect(sanitizeBranchName('multiple---dashes')).toBe('multiple-dashes');
    });

    it('should truncate long names', () => {
      const longName = 'a'.repeat(100);
      const result = sanitizeBranchName(longName);
      expect(result.length).toBeLessThanOrEqual(50);
    });
  });

  describe('truncateText', () => {
    it('should truncate text longer than max length', () => {
      const text = 'This is a very long text that should be truncated';
      expect(truncateText(text, 20)).toBe('This is a very lo...');
    });

    it('should not truncate text shorter than max length', () => {
      const text = 'Short text';
      expect(truncateText(text, 20)).toBe('Short text');
    });
  });

  describe('pluralize', () => {
    it('should return singular for count of 1', () => {
      expect(pluralize(1, 'file')).toBe('1 file');
      expect(pluralize(1, 'commit')).toBe('1 commit');
    });

    it('should return plural for count other than 1', () => {
      expect(pluralize(0, 'file')).toBe('0 files');
      expect(pluralize(2, 'file')).toBe('2 files');
      expect(pluralize(5, 'commit')).toBe('5 commits');
    });

    it('should use custom plural form', () => {
      expect(pluralize(2, 'child', 'children')).toBe('2 children');
    });
  });

  describe('getTopLevelDirectory', () => {
    it('should return directory for nested files', () => {
      expect(getTopLevelDirectory('src/lib/utils.ts')).toBe('src');
      expect(getTopLevelDirectory('tests/unit/utils.test.ts')).toBe('tests');
    });

    it('should return _root_ for root files', () => {
      expect(getTopLevelDirectory('README.md')).toBe('_root_');
      expect(getTopLevelDirectory('package.json')).toBe('_root_');
    });

    it('should handle Windows paths', () => {
      expect(getTopLevelDirectory('src\\lib\\utils.ts')).toBe('src');
    });
  });

  describe('isValidSha', () => {
    it('should validate correct SHAs', () => {
      expect(isValidSha('abc1234')).toBe(true);
      expect(isValidSha('1234567890abcdef')).toBe(true);
      expect(isValidSha('1234567890abcdef1234567890abcdef12345678')).toBe(true);
    });

    it('should reject invalid SHAs', () => {
      expect(isValidSha('123')).toBe(false); // too short
      expect(isValidSha('xyz123')).toBe(false); // invalid chars
      expect(isValidSha('')).toBe(false); // empty
    });
  });

  describe('isValidBranchName', () => {
    it('should validate correct branch names', () => {
      expect(isValidBranchName('main')).toBe(true);
      expect(isValidBranchName('feature/new-feature')).toBe(true);
      expect(isValidBranchName('fix-bug-123')).toBe(true);
    });

    it('should reject invalid branch names', () => {
      expect(isValidBranchName('')).toBe(false); // empty
      expect(isValidBranchName('.hidden')).toBe(false); // starts with dot
      expect(isValidBranchName('branch.')).toBe(false); // ends with dot
      expect(isValidBranchName('branch..name')).toBe(false); // double dot
      expect(isValidBranchName('branch name')).toBe(false); // space
    });
  });

  describe('isProtectedBranch', () => {
    it('should identify protected branches', () => {
      expect(isProtectedBranch('main')).toBe(true);
      expect(isProtectedBranch('master')).toBe(true);
      expect(isProtectedBranch('production')).toBe(true);
      expect(isProtectedBranch('release/v1.0.0')).toBe(true);
    });

    it('should not identify regular branches as protected', () => {
      expect(isProtectedBranch('feature/new-feature')).toBe(false);
      expect(isProtectedBranch('fix-bug')).toBe(false);
      expect(isProtectedBranch('develop')).toBe(false);
    });
  });

  describe('formatBytes', () => {
    it('should format bytes correctly', () => {
      expect(formatBytes(0)).toBe('0 B');
      expect(formatBytes(1024)).toBe('1 KB');
      expect(formatBytes(1024 * 1024)).toBe('1 MB');
      expect(formatBytes(1536)).toBe('1.5 KB');
    });
  });

  describe('bytesToKb', () => {
    it('should convert bytes to KB', () => {
      expect(bytesToKb(1024)).toBe(1);
      expect(bytesToKb(1536)).toBe(2); // rounded up
      expect(bytesToKb(512)).toBe(1); // rounded up
    });
  });
});
