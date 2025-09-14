import { Command } from 'commander';
import { LLMManager } from '../../lib/llm/index.js';
import { Logger } from '../../utils.js';
import { ValidationError } from '../../types.js';
import { loadConfig } from '../../config.js';
export const aiReviewCommand = new Command('review')
    .description('Generate PR description and review guidance using AI')
    .option('--provider <provider>', 'AI provider to use')
    .option('--model <model>', 'AI model to use')
    .option('--output <file>', 'save output to file')
    .option('--verbose', 'enable verbose logging')
    .action(async (options, command) => {
    const logger = new Logger(options);
    try {
        const config = await loadConfig();
        const llm = new LLMManager(config, logger);
        if (!llm.isAnyProviderConfigured()) {
            throw new ValidationError('No AI provider configured');
        }
        logger.info('🔍 Generating PR review...');
        // Implementation would analyze staged/recent changes
        // and generate comprehensive PR description
        const review = `## What
Generated PR description would appear here

## Why  
Business context and motivation

## Risk Areas
- Potential issues identified by AI

## Manual Testing
- Key scenarios to test

## Release Notes
- User-facing changes`;
        if (options.output) {
            await import('fs/promises').then(fs => fs.writeFile(options.output, review, 'utf8'));
            logger.success(`✅ Review saved to ${options.output}`);
        }
        else {
            console.log(review);
        }
    }
    catch (error) {
        logger.error(`AI review failed: ${error}`);
        throw error;
    }
});
//# sourceMappingURL=review.js.map