import { describe, it, expect } from 'vitest';
import { RedactionManager } from '../../src/lib/redact.js';
import { Logger } from '../../src/utils.js';

describe('RedactionManager', () => {
  const logger = new Logger({ verbose: false });
  const redactionManager = new RedactionManager(logger);

  describe('shouldBlockFile', () => {
    it('should block sensitive files', () => {
      expect(redactionManager.shouldBlockFile('.env')).toBe(true);
      expect(redactionManager.shouldBlockFile('.env.local')).toBe(true);
      expect(redactionManager.shouldBlockFile('config/.env.production')).toBe(true);
      expect(redactionManager.shouldBlockFile('private.key')).toBe(true);
      expect(redactionManager.shouldBlockFile('cert.pem')).toBe(true);
      expect(redactionManager.shouldBlockFile('.npmrc')).toBe(true);
      expect(redactionManager.shouldBlockFile('id_rsa')).toBe(true);
      expect(redactionManager.shouldBlockFile('.aws/credentials')).toBe(true);
      expect(redactionManager.shouldBlockFile('.kube/config')).toBe(true);
    });

    it('should allow regular files', () => {
      expect(redactionManager.shouldBlockFile('src/index.ts')).toBe(false);
      expect(redactionManager.shouldBlockFile('README.md')).toBe(false);
      expect(redactionManager.shouldBlockFile('package.json')).toBe(false);
      expect(redactionManager.shouldBlockFile('tests/test.js')).toBe(false);
    });
  });

  describe('filterFiles', () => {
    it('should separate allowed and blocked files', () => {
      const files = [
        'src/index.ts',
        '.env',
        'README.md',
        'private.key',
        'package.json'
      ];

      const result = redactionManager.filterFiles(files);

      expect(result.allowed).toEqual([
        'src/index.ts',
        'README.md',
        'package.json'
      ]);
      expect(result.blocked).toEqual([
        '.env',
        'private.key'
      ]);
    });
  });

  describe('redactContent', () => {
    it('should redact passwords', () => {
      const content = 'password = "secret123"';
      const result = redactionManager.redactContent(content);
      
      expect(result.content).toContain('[REDACTED]');
      expect(result.redactedPatterns).toContain('Password field');
    });

    it('should redact API keys', () => {
      const content = 'api_key: abc123def456';
      const result = redactionManager.redactContent(content);
      
      expect(result.content).toContain('[REDACTED]');
      expect(result.redactedPatterns).toContain('API key');
    });

    it('should redact OpenAI keys', () => {
      const content = 'OPENAI_API_KEY=sk-1234567890abcdef1234567890abcdef';
      const result = redactionManager.redactContent(content);
      
      expect(result.content).toContain('sk-[REDACTED]');
      expect(result.redactedPatterns).toContain('OpenAI API key');
    });

    it('should redact GitHub tokens', () => {
      const content = 'token: ghp_1234567890abcdef1234567890abcdef123456';
      const result = redactionManager.redactContent(content);
      
      expect(result.content).toContain('ghp_[REDACTED]');
      expect(result.redactedPatterns).toContain('GitHub personal access token');
    });

    it('should redact AWS access keys', () => {
      const content = 'AWS_ACCESS_KEY_ID=AKIAIOSFODNN7EXAMPLE';
      const result = redactionManager.redactContent(content);
      
      expect(result.content).toContain('AKIA[REDACTED]');
      expect(result.redactedPatterns).toContain('AWS access key');
    });

    it('should redact private keys', () => {
      const content = `-----BEGIN PRIVATE KEY-----
MIIEvgIBADANBgkqhkiG9w0BAQEFAASCBKgwggSkAgEAAoIBAQC7VJTUt9Us8cKB
-----END PRIVATE KEY-----`;
      const result = redactionManager.redactContent(content);
      
      expect(result.content).toContain('[REDACTED KEY]');
      expect(result.redactedPatterns).toContain('Private key');
    });

    it('should not modify safe content', () => {
      const content = 'const greeting = "Hello, world!";';
      const result = redactionManager.redactContent(content);
      
      expect(result.content).toBe(content);
      expect(result.redactedPatterns).toHaveLength(0);
    });
  });

  describe('processDiffForAI', () => {
    it('should filter files and redact content', () => {
      const diffContent = 'password = "secret123"\nconst x = 1;';
      const files = ['src/index.ts', '.env', 'README.md'];

      const result = redactionManager.processDiffForAI(diffContent, files);

      expect(result.redactedFiles).toContain('.env');
      expect(result.content).toContain('[REDACTED]');
      expect(result.redactedPatterns.length).toBeGreaterThan(0);
    });

    it('should truncate large content', () => {
      const largeContent = 'x'.repeat(200 * 1024); // 200KB
      const result = redactionManager.processDiffForAI(largeContent, [], { maxKb: 96 });

      expect(result.content.length).toBeLessThan(100 * 1024);
      expect(result.content).toContain('truncated for safety');
      expect(result.warnings).toContain('Content truncated due to size limit');
    });
  });

  describe('validateContentSafety', () => {
    it('should identify potential risks', () => {
      const content = 'localhost:3000/admin?password=secret&token=abc123def456ghi789';
      const result = redactionManager.validateContentSafety(content);

      expect(result.isSafe).toBe(false);
      expect(result.risks.length).toBeGreaterThan(0);
      expect(result.recommendations.length).toBeGreaterThan(0);
    });

    it('should pass safe content', () => {
      const content = 'const hello = "world";';
      const result = redactionManager.validateContentSafety(content);

      expect(result.isSafe).toBe(true);
      expect(result.risks).toHaveLength(0);
    });
  });
});
