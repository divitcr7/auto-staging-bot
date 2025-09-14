import { Command } from 'commander';
import { Git } from '../../lib/git.js';
import { DiffManager } from '../../lib/diff.js';
import { RedactionManager } from '../../lib/redact.js';
import { LLMManager } from '../../lib/llm/index.js';
import { SafetyManager } from '../../lib/safety.js';
import { Logger, confirm } from '../../utils.js';
import { AIOptions, CommitSuggestion, ValidationError } from '../../types.js';
import { loadConfig } from '../../config.js';

export const aiCommitCommand = new Command('commit')
  .description('Generate commit message using AI based on staged changes')
  .option('--provider <provider>', 'AI provider to use (openai, anthropic, azure-openai, ollama)')
  .option('--model <model>', 'AI model to use')
  .option('--max-kb <number>', 'maximum diff size in KB to send to AI', '96')
  .option('--apply', 'automatically commit with generated message')
  .option('--json', 'output structured JSON instead of human-readable text')
  .option('--print-redactions', 'show what content was redacted for security')
  .option('--verbose', 'enable verbose logging')
  .option('--no-color', 'disable colored output')
  .action(async (options: AIOptions, command) => {
    const logger = new Logger(options);
    const git = new Git(logger);
    const diff = new DiffManager(git, logger);
    const redact = new RedactionManager(logger);
    const safety = new SafetyManager(git, logger);

    try {
      // Load configuration
      const config = await loadConfig();
      const llm = new LLMManager(config, logger);

      // Check if any provider is configured
      if (!llm.isAnyProviderConfigured()) {
        throw new ValidationError(
          'No AI provider configured. Please set up OpenAI, Anthropic, Azure OpenAI, or Ollama.\n' +
          'See documentation for configuration instructions.'
        );
      }

      // Validate repository state
      await safety.validateRepositoryState();

      // Get staged files
      const stagedFiles = await diff.getStagedFiles();
      if (stagedFiles.length === 0) {
        throw new ValidationError(
          'No staged files found. Stage some files first with: git add <files>'
        );
      }

      logger.info(`📊 Analyzing ${stagedFiles.length} staged files...`);

      // Get diff content with security filtering
      const maxKb = parseInt(options.maxKb || '96', 10);
      const diffResult = await diff.getStagedDiffContent({
        maxKb,
        unified: 0, // Minimal context for AI
        includeContext: true,
      });

      // Apply security redaction
      const redactionResult = redact.processDiffForAI(
        diffResult.content,
        stagedFiles,
        {
          maxKb,
          printRedactions: options.printRedactions,
        }
      );

      // Show redaction report if requested
      if (options.printRedactions) {
        const report = redact.generateRedactionReport(redactionResult);
        logger.info('\n🔒 Security Report:');
        for (const line of report) {
          logger.info(line);
        }
      }

      // Get repository context
      const repoContext = await diff.getRepositoryContext();
      
      // Build prompt
      const systemPrompt = llm.getCommitPromptTemplate();
      
      const contextInfo = [
        `Repository context:`,
        `- Languages: ${repoContext.languages.join(', ') || 'Unknown'}`,
        `- Frameworks: ${repoContext.frameworks.join(', ') || 'Unknown'}`,
        `- Files changed: ${stagedFiles.length}`,
        '',
        'Staged files:',
        ...stagedFiles.map(f => `- ${f}`),
        '',
        'Diff:',
        redactionResult.content,
      ].join('\n');

      logger.verbose('Sending request to AI provider...');

      // Generate commit message
      const response = await llm.generateWithSystemPrompt(
        systemPrompt,
        contextInfo,
        {
          provider: options.provider,
          model: options.model,
          maxTokens: 300,
          temperature: 0.1,
        }
      );

      // Parse response
      const titleMatch = response.match(/Title:\s*(.+)/);
      const bodyMatch = response.match(/Body:\s*([\s\S]+?)(?:\n\n|\n$|$)/);

      if (!titleMatch) {
        throw new ValidationError('AI response does not contain a valid commit title');
      }

      const suggestion: CommitSuggestion = {
        title: titleMatch[1].trim(),
        body: bodyMatch ? bodyMatch[1].trim() : '',
      };

      // Output result
      if (options.json) {
        console.log(JSON.stringify(suggestion, null, 2));
        return;
      }

      // Human-readable output
      logger.success('🤖 AI-generated commit message:');
      console.log();
      console.log(suggestion.title);
      if (suggestion.body) {
        console.log();
        console.log(suggestion.body);
      }
      console.log();

      // Apply commit if requested
      if (options.apply) {
        const fullMessage = suggestion.body 
          ? `${suggestion.title}\n\n${suggestion.body}`
          : suggestion.title;

        logger.info('📝 Committing with AI-generated message...');
        await git.commit(fullMessage);
        logger.success('✅ Commit created successfully');
        
        // Show commit details
        const lastCommit = await git.getLastCommit();
        logger.info(`📋 Commit: ${lastCommit.sha.substring(0, 8)} ${lastCommit.subject}`);
        
      } else {
        // Ask if user wants to commit
        const shouldCommit = await confirm(
          'Commit with this message?',
          false,
          options
        );

        if (shouldCommit) {
          const fullMessage = suggestion.body 
            ? `${suggestion.title}\n\n${suggestion.body}`
            : suggestion.title;

          await git.commit(fullMessage);
          logger.success('✅ Commit created successfully');
          
          const lastCommit = await git.getLastCommit();
          logger.info(`📋 Commit: ${lastCommit.sha.substring(0, 8)} ${lastCommit.subject}`);
        } else {
          logger.info('💾 Message saved to clipboard (if available)');
          logger.info('   Run: git commit -m "' + suggestion.title + '"');
        }
      }

      // Show warnings if any
      if (redactionResult.warnings.length > 0) {
        logger.warn('\n⚠️  Security warnings:');
        for (const warning of redactionResult.warnings) {
          logger.warn(`  • ${warning}`);
        }
      }

    } catch (error) {
      logger.error(`AI commit failed: ${error}`);
      throw error;
    }
  });
