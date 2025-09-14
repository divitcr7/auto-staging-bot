import path from 'path';
import { Logger } from '../utils.js';

export interface RedactionResult {
  content: string;
  redactedFiles: string[];
  redactedPatterns: string[];
  warnings: string[];
}

export class RedactionManager {
  constructor(private logger: Logger) {}

  // File patterns that should never be included
  private readonly BLOCKED_FILE_PATTERNS = [
    // Credential files
    /\.env(\.|$)/i,
    /\.env\..*/i,
    /\.pem$/i,
    /\.key$/i,
    /\.p12$/i,
    /\.keystore$/i,
    /\.jks$/i,
    /\.cert$/i,
    /\.crt$/i,
    /\.pfx$/i,
    
    // Config files with secrets
    /\.npmrc$/i,
    /\.pypirc$/i,
    /\.netrc$/i,
    /\.gitconfig$/i,
    
    // SSH and AWS
    /id_rsa/i,
    /id_ed25519/i,
    /known_hosts$/i,
    /authorized_keys$/i,
    /\.aws\/config$/i,
    /\.aws\/credentials$/i,
    
    // Kubernetes
    /\.kube\/config$/i,
    /kubeconfig$/i,
    
    // Database
    /\.my\.cnf$/i,
    /\.pgpass$/i,
    
    // Cloud providers
    /\.gcp\/.*\.json$/i,
    /\.azure\/.*$/i,
    
    // Build artifacts that might contain secrets
    /\.terraform\.tfstate$/i,
    /terraform\.tfvars$/i,
    /\.gradle\/gradle\.properties$/i,
  ];

  // Secret patterns to redact from content
  private readonly SECRET_PATTERNS = [
    // Generic patterns
    {
      pattern: /password\s*[=:]\s*["']?([^\s"']+)/gi,
      replacement: 'password="[REDACTED]"',
      description: 'Password field',
    },
    {
      pattern: /api[_-]?key\s*[=:]\s*["']?([a-zA-Z0-9_\-]{10,})/gi,
      replacement: 'api_key="[REDACTED]"',
      description: 'API key',
    },
    {
      pattern: /secret\s*[=:]\s*["']?([^\s"']+)/gi,
      replacement: 'secret="[REDACTED]"',
      description: 'Secret field',
    },
    {
      pattern: /token\s*[=:]\s*["']?([a-zA-Z0-9_\-]{10,})/gi,
      replacement: 'token="[REDACTED]"',
      description: 'Token field',
    },
    
    // Specific service tokens
    {
      pattern: /sk-[a-zA-Z0-9]{32,}/gi,
      replacement: 'sk-[REDACTED]',
      description: 'OpenAI API key',
    },
    {
      pattern: /ghp_[a-zA-Z0-9]{36}/gi,
      replacement: 'ghp_[REDACTED]',
      description: 'GitHub personal access token',
    },
    {
      pattern: /ghs_[a-zA-Z0-9]{36}/gi,
      replacement: 'ghs_[REDACTED]',
      description: 'GitHub app token',
    },
    {
      pattern: /gho_[a-zA-Z0-9]{36}/gi,
      replacement: 'gho_[REDACTED]',
      description: 'GitHub OAuth token',
    },
    {
      pattern: /ghu_[a-zA-Z0-9]{36}/gi,
      replacement: 'ghu_[REDACTED]',
      description: 'GitHub user token',
    },
    {
      pattern: /glpat-[a-zA-Z0-9_\-]{20}/gi,
      replacement: 'glpat-[REDACTED]',
      description: 'GitLab personal access token',
    },
    
    // AWS
    {
      pattern: /AKIA[A-Z0-9]{16}/gi,
      replacement: 'AKIA[REDACTED]',
      description: 'AWS access key',
    },
    {
      pattern: /aws_secret_access_key\s*[=:]\s*["']?([a-zA-Z0-9/+=]{40})/gi,
      replacement: 'aws_secret_access_key="[REDACTED]"',
      description: 'AWS secret key',
    },
    
    // Azure
    {
      pattern: /[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}/gi,
      replacement: '[REDACTED-UUID]',
      description: 'Azure client ID/UUID',
    },
    
    // GCP
    {
      pattern: /"type":\s*"service_account"/gi,
      replacement: '"type": "service_account [REDACTED]"',
      description: 'GCP service account key',
    },
    
    // Database URLs
    {
      pattern: /(postgres|mysql|mongodb):\/\/[^@]+@[^\/]+\//gi,
      replacement: '$1://[REDACTED]@[REDACTED]/',
      description: 'Database connection string',
    },
    
    // JWT tokens
    {
      pattern: /eyJ[a-zA-Z0-9_\-]*\.eyJ[a-zA-Z0-9_\-]*\.[a-zA-Z0-9_\-]*/gi,
      replacement: 'eyJ[REDACTED].eyJ[REDACTED].[REDACTED]',
      description: 'JWT token',
    },
    
    // Private keys
    {
      pattern: /-----BEGIN [A-Z ]+-----[\s\S]*?-----END [A-Z ]+-----/gi,
      replacement: '-----BEGIN [REDACTED KEY]-----\n[REDACTED]\n-----END [REDACTED KEY]-----',
      description: 'Private key',
    },
    
    // Credit card numbers (basic pattern)
    {
      pattern: /\b(?:4[0-9]{12}(?:[0-9]{3})?|5[1-5][0-9]{14}|3[47][0-9]{13}|3[0-9]{13}|6(?:011|5[0-9]{2})[0-9]{12})\b/gi,
      replacement: '[REDACTED-CARD]',
      description: 'Credit card number',
    },
    
    // Social Security Numbers
    {
      pattern: /\b\d{3}-\d{2}-\d{4}\b/gi,
      replacement: '[REDACTED-SSN]',
      description: 'Social Security Number',
    },
    
    // Email addresses in certain contexts (when they might be sensitive)
    {
      pattern: /admin@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/gi,
      replacement: 'admin@[REDACTED]',
      description: 'Admin email address',
    },
  ];

  // Check if a file should be blocked entirely
  shouldBlockFile(filePath: string): boolean {
    const normalizedPath = path.normalize(filePath).replace(/\\/g, '/');
    return this.BLOCKED_FILE_PATTERNS.some(pattern => pattern.test(normalizedPath));
  }

  // Filter out blocked files from a file list
  filterFiles(files: string[]): {
    allowed: string[];
    blocked: string[];
  } {
    const allowed: string[] = [];
    const blocked: string[] = [];

    for (const file of files) {
      if (this.shouldBlockFile(file)) {
        blocked.push(file);
      } else {
        allowed.push(file);
      }
    }

    return { allowed, blocked };
  }

  // Redact content for safe transmission
  redactContent(content: string, options: {
    printRedactions?: boolean;
  } = {}): RedactionResult {
    let redactedContent = content;
    const redactedPatterns: string[] = [];
    const warnings: string[] = [];

    // Apply each redaction pattern
    for (const secretPattern of this.SECRET_PATTERNS) {
      const matches = content.match(secretPattern.pattern);
      if (matches) {
        redactedContent = redactedContent.replace(
          secretPattern.pattern,
          secretPattern.replacement
        );
        redactedPatterns.push(secretPattern.description);
        
        if (options.printRedactions) {
          this.logger.verbose(`Redacted: ${secretPattern.description} (${matches.length} instances)`);
        }
      }
    }

    // Additional warnings for suspicious content
    if (content.includes('process.env') && !content.includes('NODE_ENV')) {
      warnings.push('Contains environment variable access');
    }

    if (content.match(/\$\{[^}]*\}/g)) {
      warnings.push('Contains variable interpolation');
    }

    if (content.includes('eval(') || content.includes('Function(')) {
      warnings.push('Contains dynamic code execution');
    }

    return {
      content: redactedContent,
      redactedFiles: [], // Will be set by caller
      redactedPatterns,
      warnings,
    };
  }

  // Process diff content for AI submission
  processDiffForAI(diffContent: string, files: string[], options: {
    maxKb?: number;
    printRedactions?: boolean;
  } = {}): RedactionResult {
    const { maxKb = 96, printRedactions = false } = options;

    // Filter files
    const { allowed, blocked } = this.filterFiles(files);
    
    if (blocked.length > 0) {
      if (printRedactions) {
        this.logger.warn(`Blocked ${blocked.length} sensitive files from AI submission`);
        for (const file of blocked) {
          this.logger.verbose(`  Blocked: ${file}`);
        }
      }
    }

    // Redact content
    const redactionResult = this.redactContent(diffContent, { printRedactions });
    
    // Truncate if necessary
    let finalContent = redactionResult.content;
    const maxBytes = maxKb * 1024;
    
    if (Buffer.byteLength(finalContent, 'utf8') > maxBytes) {
      const buffer = Buffer.from(finalContent, 'utf8');
      finalContent = buffer.subarray(0, maxBytes).toString('utf8');
      
      // Try to end at a line boundary
      const lastNewline = finalContent.lastIndexOf('\n');
      if (lastNewline > maxBytes * 0.8) {
        finalContent = finalContent.substring(0, lastNewline);
      }
      
      finalContent += '\n\n[... content truncated for safety ...]';
      redactionResult.warnings.push('Content truncated due to size limit');
    }

    return {
      content: finalContent,
      redactedFiles: blocked,
      redactedPatterns: redactionResult.redactedPatterns,
      warnings: redactionResult.warnings,
    };
  }

  // Generate redaction report
  generateRedactionReport(result: RedactionResult): string[] {
    const report: string[] = [];

    if (result.redactedFiles.length > 0) {
      report.push('🛡️  Files excluded for security:');
      for (const file of result.redactedFiles) {
        report.push(`  • ${file}`);
      }
      report.push('');
    }

    if (result.redactedPatterns.length > 0) {
      report.push('🔒 Content redacted:');
      for (const pattern of result.redactedPatterns) {
        report.push(`  • ${pattern}`);
      }
      report.push('');
    }

    if (result.warnings.length > 0) {
      report.push('⚠️  Warnings:');
      for (const warning of result.warnings) {
        report.push(`  • ${warning}`);
      }
      report.push('');
    }

    if (report.length === 0) {
      report.push('✅ No sensitive content detected');
    }

    return report;
  }

  // Validate that content is safe for AI submission
  validateContentSafety(content: string): {
    isSafe: boolean;
    risks: string[];
    recommendations: string[];
  } {
    const risks: string[] = [];
    const recommendations: string[] = [];

    // Check for remaining secrets that might have been missed
    if (content.match(/[a-zA-Z0-9]{32,}/g)) {
      risks.push('Contains long alphanumeric strings that might be secrets');
      recommendations.push('Review any long strings manually');
    }

    if (content.includes('localhost') && content.includes('password')) {
      risks.push('Contains localhost configuration with password');
      recommendations.push('Ensure local credentials are not exposed');
    }

    if (content.match(/\.(com|org|net|io)\/[a-zA-Z0-9\/]+/g)) {
      risks.push('Contains external URLs that might expose internal information');
      recommendations.push('Review URLs for sensitive paths or parameters');
    }

    const isSafe = risks.length === 0;

    return {
      isSafe,
      risks,
      recommendations,
    };
  }
}
