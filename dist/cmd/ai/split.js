import { Command } from 'commander';
import { Git } from '../../lib/git.js';
import { DiffManager } from '../../lib/diff.js';
import { RedactionManager } from '../../lib/redact.js';
import { LLMManager } from '../../lib/llm/index.js';
import { SafetyManager } from '../../lib/safety.js';
import { Logger, confirm, pluralize } from '../../utils.js';
import { ValidationError } from '../../types.js';
import { loadConfig } from '../../config.js';
export const aiSplitCommand = new Command('split')
    .description('Intelligently split staged changes using AI semantic analysis')
    .option('--provider <provider>', 'AI provider to use')
    .option('--model <model>', 'AI model to use')
    .option('--max-kb <number>', 'maximum diff size in KB', '96')
    .option('--apply', 'execute the split plan automatically')
    .option('--json', 'output JSON plan instead of human-readable text')
    .option('--print-redactions', 'show redacted content')
    .option('--verbose', 'enable verbose logging')
    .action(async (options, command) => {
    const logger = new Logger(options);
    const git = new Git(logger);
    const diff = new DiffManager(git, logger);
    const redact = new RedactionManager(logger);
    const safety = new SafetyManager(git, logger);
    try {
        const config = await loadConfig();
        const llm = new LLMManager(config, logger);
        if (!llm.isAnyProviderConfigured()) {
            throw new ValidationError('No AI provider configured');
        }
        await safety.validateRepositoryState();
        const stagedFiles = await diff.getStagedFiles();
        if (stagedFiles.length === 0) {
            throw new ValidationError('No staged files found');
        }
        logger.info(`🧠 AI-analyzing ${stagedFiles.length} staged files...`);
        // Get diff with context
        const maxKb = parseInt(options.maxKb || '96', 10);
        const diffResult = await diff.getStagedDiffContent({ maxKb, unified: 1 });
        const redactionResult = redact.processDiffForAI(diffResult.content, stagedFiles, { maxKb, printRedactions: options.printRedactions });
        const systemPrompt = llm.getSplitPromptTemplate();
        const userPrompt = `Files to split:\n${stagedFiles.join('\n')}\n\nDiff:\n${redactionResult.content}`;
        const response = await llm.generateCompletion(`${systemPrompt}\n\n${userPrompt}`, {
            provider: options.provider,
            model: options.model,
            maxTokens: 500,
            temperature: 0.1,
        });
        // Parse JSON response
        let splitPlan;
        try {
            splitPlan = JSON.parse(response);
        }
        catch {
            const jsonMatch = response.match(/\[[\s\S]*\]/);
            if (jsonMatch) {
                splitPlan = JSON.parse(jsonMatch[0]);
            }
            else {
                throw new ValidationError('AI response is not valid JSON');
            }
        }
        if (options.json) {
            console.log(JSON.stringify(splitPlan, null, 2));
            return;
        }
        // Show plan
        logger.success(`🤖 AI split plan (${pluralize(splitPlan.length, 'commit')}):`);
        for (let i = 0; i < splitPlan.length; i++) {
            const group = splitPlan[i];
            logger.info(`\n${i + 1}. ${group.title}`);
            for (const file of group.paths.slice(0, 5)) {
                logger.info(`   • ${file}`);
            }
            if (group.paths.length > 5) {
                logger.info(`   ... and ${group.paths.length - 5} more`);
            }
        }
        if (options.apply) {
            logger.info('\n🚀 Executing AI split plan...');
        }
        else {
            const shouldApply = await confirm('\nExecute this split plan?', false, options);
            if (!shouldApply) {
                logger.info('Split plan not executed');
                return;
            }
        }
        // Create safety tag
        const safetyTag = await safety.createSafetyTag('ai-split-before');
        let commitsCreated = 0;
        // Execute plan
        for (const group of splitPlan) {
            await git.unstageAll();
            // Filter valid files
            const validFiles = group.paths.filter(f => stagedFiles.includes(f));
            if (validFiles.length === 0)
                continue;
            await git.stage(validFiles);
            const status = await git.getStatus();
            if (status.staged.length === 0)
                continue;
            logger.info(`Creating: ${group.title}`);
            await git.commit(group.title);
            commitsCreated++;
        }
        logger.success(`✅ Created ${pluralize(commitsCreated, 'commit')} from AI plan`);
        logger.info(`Safety tag: ${safetyTag.name}`);
    }
    catch (error) {
        logger.error(`AI split failed: ${error}`);
        throw error;
    }
});
//# sourceMappingURL=split.js.map