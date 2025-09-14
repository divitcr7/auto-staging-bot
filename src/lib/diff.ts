import { Git } from './git.js';
import { FileGroup } from '../types.js';
import { getTopLevelDirectory, formatBytes, bytesToKb, Logger } from '../utils.js';

export class DiffManager {
  constructor(
    private git: Git,
    private logger: Logger
  ) {}

  // Get staged files and group them
  async getStagedFiles(): Promise<string[]> {
    const diff = await this.git.getStagedDiff({ nameOnly: true });
    return diff
      .split('\n')
      .filter(line => line.trim() !== '')
      .map(line => line.trim());
  }

  // Group files by top-level directory
  groupFilesByDirectory(files: string[]): FileGroup[] {
    const groups = new Map<string, string[]>();

    for (const file of files) {
      const directory = getTopLevelDirectory(file);
      
      if (!groups.has(directory)) {
        groups.set(directory, []);
      }
      groups.get(directory)!.push(file);
    }

    // Convert to array and sort by directory name
    const result: FileGroup[] = [];
    const sortedDirs = Array.from(groups.keys()).sort((a, b) => {
      // _root_ comes last
      if (a === '_root_' && b !== '_root_') return 1;
      if (b === '_root_' && a !== '_root_') return -1;
      return a.localeCompare(b);
    });

    for (const directory of sortedDirs) {
      result.push({
        directory,
        files: groups.get(directory)!.sort(),
      });
    }

    return result;
  }

  // Get diff content with size limits
  async getStagedDiffContent(options: {
    maxKb?: number;
    unified?: number;
    includeContext?: boolean;
  } = {}): Promise<{
    content: string;
    size: number;
    truncated: boolean;
  }> {
    const { maxKb = 96, unified = 0, includeContext = false } = options;

    let content = await this.git.getStagedDiff({ unified });

    // Add basic context if requested
    if (includeContext) {
      const status = await this.git.getStatus();
      const contextInfo = [
        `# Repository Context`,
        `Branch: ${status.branch}`,
        `Staged files: ${status.staged.length}`,
        `Unstaged files: ${status.unstaged.length}`,
        ``,
        `# Staged Diff`,
        '',
      ].join('\n');
      
      content = contextInfo + content;
    }

    const size = Buffer.byteLength(content, 'utf8');
    const sizeKb = bytesToKb(size);
    let truncated = false;

    if (sizeKb > maxKb) {
      // Truncate content to fit within limit
      const maxBytes = maxKb * 1024;
      const buffer = Buffer.from(content, 'utf8');
      content = buffer.subarray(0, maxBytes).toString('utf8');
      
      // Try to end at a line boundary
      const lastNewline = content.lastIndexOf('\n');
      if (lastNewline > maxBytes * 0.8) {
        content = content.substring(0, lastNewline);
      }
      
      content += '\n\n[... content truncated ...]';
      truncated = true;
      
      this.logger.warn(
        `Diff content truncated from ${formatBytes(size)} to ${formatBytes(maxBytes)}`
      );
    }

    return {
      content,
      size,
      truncated,
    };
  }

  // Get diff for specific files
  async getDiffForFiles(files: string[], options: {
    staged?: boolean;
    unified?: number;
  } = {}): Promise<string> {
    const { staged = true, unified = 3 } = options;
    
    if (files.length === 0) {
      return '';
    }

    const args = ['diff'];
    if (staged) {
      args.push('--cached');
    }
    args.push(`--unified=${unified}`);
    args.push('--', ...files);

    return this.git.exec(args);
  }

  // Apply patches from AI suggestions
  async applyPatch(patchContent: string, options: {
    threeWay?: boolean;
    check?: boolean;
  } = {}): Promise<{
    success: boolean;
    conflicts: string[];
    errors: string[];
  }> {
    const { threeWay = true, check = false } = options;

    const args = ['apply'];
    if (threeWay) {
      args.push('--3way');
    }
    if (check) {
      args.push('--check');
    }
    args.push('--index'); // Apply to both working tree and index

    try {
      // Write patch to temporary file
      const tempFile = `/tmp/git-oops-patch-${Date.now()}.patch`;
      await import('fs/promises').then(fs => 
        fs.writeFile(tempFile, patchContent, 'utf8')
      );

      try {
        await this.git.exec([...args, tempFile]);
        
        // Clean up temp file
        await import('fs/promises').then(fs => fs.unlink(tempFile));
        
        return {
          success: true,
          conflicts: [],
          errors: [],
        };
      } catch (error: any) {
        // Clean up temp file
        await import('fs/promises').then(fs => fs.unlink(tempFile).catch(() => {}));
        
        // Parse git apply errors
        const errorText = error.message || '';
        const conflicts: string[] = [];
        const errors: string[] = [];

        // Extract conflict information
        if (errorText.includes('conflict')) {
          const lines = errorText.split('\n');
          for (const line of lines) {
            if (line.includes('conflict in')) {
              const match = line.match(/conflict in (.+)/);
              if (match) {
                conflicts.push(match[1]);
              }
            }
          }
        }

        if (conflicts.length === 0) {
          errors.push(errorText);
        }

        return {
          success: false,
          conflicts,
          errors,
        };
      }
    } catch (error: any) {
      return {
        success: false,
        conflicts: [],
        errors: [error.message || 'Unknown error applying patch'],
      };
    }
  }

  // Extract context around changes
  async getChangeContext(file: string, lineNumber: number, contextLines = 3): Promise<{
    before: string[];
    change: string;
    after: string[];
  }> {
    try {
      const content = await import('fs/promises').then(fs =>
        fs.readFile(file, 'utf8')
      );
      
      const lines = content.split('\n');
      const targetIndex = lineNumber - 1; // Convert to 0-based
      
      const before = lines.slice(
        Math.max(0, targetIndex - contextLines),
        targetIndex
      );
      
      const change = lines[targetIndex] || '';
      
      const after = lines.slice(
        targetIndex + 1,
        Math.min(lines.length, targetIndex + 1 + contextLines)
      );

      return { before, change, after };
    } catch {
      return {
        before: [],
        change: '',
        after: [],
      };
    }
  }

  // Get file list with basic language detection
  async getRepositoryContext(): Promise<{
    languages: string[];
    frameworks: string[];
    fileCount: number;
  }> {
    try {
      // Get all tracked files
      const files = await this.git.exec(['ls-files']);
      const fileList = files.split('\n').filter(f => f.trim() !== '');
      
      const extensions = new Set<string>();
      const frameworks = new Set<string>();

      for (const file of fileList) {
        const ext = file.split('.').pop()?.toLowerCase();
        if (ext) {
          extensions.add(ext);
        }

        // Basic framework detection
        const fileName = file.toLowerCase();
        if (fileName.includes('package.json')) frameworks.add('Node.js');
        if (fileName.includes('requirements.txt') || fileName.includes('pyproject.toml')) frameworks.add('Python');
        if (fileName.includes('cargo.toml')) frameworks.add('Rust');
        if (fileName.includes('go.mod')) frameworks.add('Go');
        if (fileName.includes('composer.json')) frameworks.add('PHP');
        if (fileName.includes('pom.xml') || fileName.includes('build.gradle')) frameworks.add('Java');
        if (fileName.includes('dockerfile')) frameworks.add('Docker');
        if (fileName.includes('.yml') || fileName.includes('.yaml')) {
          if (fileName.includes('docker-compose')) frameworks.add('Docker Compose');
          if (fileName.includes('.github/workflows')) frameworks.add('GitHub Actions');
        }
      }

      // Map extensions to languages
      const languageMap: Record<string, string> = {
        js: 'JavaScript',
        ts: 'TypeScript',
        jsx: 'React',
        tsx: 'React/TypeScript',
        py: 'Python',
        rs: 'Rust',
        go: 'Go',
        java: 'Java',
        kt: 'Kotlin',
        php: 'PHP',
        rb: 'Ruby',
        c: 'C',
        cpp: 'C++',
        cs: 'C#',
        swift: 'Swift',
        scala: 'Scala',
        clj: 'Clojure',
        hs: 'Haskell',
        elm: 'Elm',
        dart: 'Dart',
        r: 'R',
        jl: 'Julia',
        sql: 'SQL',
        sh: 'Shell',
        bash: 'Bash',
        zsh: 'Zsh',
        fish: 'Fish',
        ps1: 'PowerShell',
        html: 'HTML',
        css: 'CSS',
        scss: 'SCSS',
        sass: 'Sass',
        less: 'Less',
        md: 'Markdown',
        json: 'JSON',
        yaml: 'YAML',
        yml: 'YAML',
        xml: 'XML',
        toml: 'TOML',
        ini: 'INI',
      };

      const languages = Array.from(extensions)
        .map(ext => languageMap[ext])
        .filter(Boolean)
        .slice(0, 5); // Limit to top 5

      return {
        languages,
        frameworks: Array.from(frameworks).slice(0, 5),
        fileCount: fileList.length,
      };
    } catch {
      return {
        languages: [],
        frameworks: [],
        fileCount: 0,
      };
    }
  }

  // Validate diff content for safety
  validateDiffForSafety(diffContent: string): {
    isSecure: boolean;
    warnings: string[];
    blockedPatterns: string[];
  } {
    const warnings: string[] = [];
    const blockedPatterns: string[] = [];

    // Patterns that should never be in diffs sent to AI
    const dangerousPatterns = [
      /password\s*[=:]\s*["']?[^\s"']+/gi,
      /api[_-]?key\s*[=:]\s*["']?[a-zA-Z0-9_\-]{10,}/gi,
      /secret\s*[=:]\s*["']?[^\s"']+/gi,
      /token\s*[=:]\s*["']?[a-zA-Z0-9_\-]{10,}/gi,
      /-----BEGIN [A-Z ]+-----/gi,
      /sk-[a-zA-Z0-9]{32,}/gi, // OpenAI keys
      /ghp_[a-zA-Z0-9]{36}/gi, // GitHub tokens
      /ghs_[a-zA-Z0-9]{36}/gi, // GitHub tokens
      /AKIA[A-Z0-9]{16}/gi, // AWS access keys
    ];

    for (const pattern of dangerousPatterns) {
      const matches = diffContent.match(pattern);
      if (matches) {
        blockedPatterns.push(...matches);
      }
    }

    // Additional warnings for suspicious content
    if (diffContent.includes('process.env')) {
      warnings.push('Contains environment variable access');
    }

    if (diffContent.match(/\.(env|key|pem|p12|keystore)\b/gi)) {
      warnings.push('References sensitive file types');
    }

    const isSecure = blockedPatterns.length === 0;

    return {
      isSecure,
      warnings,
      blockedPatterns,
    };
  }
}
