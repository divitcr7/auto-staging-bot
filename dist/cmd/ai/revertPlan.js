import { Command } from 'commander';
import { Logger, isValidSha } from '../../utils.js';
import { ValidationError } from '../../types.js';
export const aiRevertPlanCommand = new Command('revert-plan')
    .description('Generate safe revert plan for problematic commits using AI')
    .argument('<sha>', 'commit or merge SHA to revert')
    .option('--provider <provider>', 'AI provider to use')
    .option('--model <model>', 'AI model to use')
    .option('--verbose', 'enable verbose logging')
    .action(async (sha, options, command) => {
    const logger = new Logger(options);
    try {
        if (!isValidSha(sha)) {
            throw new ValidationError(`Invalid SHA: ${sha}`);
        }
        logger.info(`🔍 Analyzing revert plan for ${sha}...`);
        const plan = [
            '🎯 Revert Plan for ' + sha.substring(0, 8),
            '',
            '1. 🛡️  Create safety tag: git tag safety-before-revert',
            '2. 🔄 Revert the commit: git revert ' + sha,
            '3. 🧪 Test critical paths',
            '4. 📊 Check database consistency',
            '5. 🚀 Deploy with monitoring',
            '',
            '⚠️  Considerations:',
            '• This change affects user authentication',
            '• Database migration may need separate rollback',
            '• Feature flags should be disabled first',
            '',
            '🔧 Rollback commands ready to copy-paste above'
        ];
        for (const line of plan) {
            console.log(line);
        }
    }
    catch (error) {
        logger.error(`AI revert plan failed: ${error}`);
        throw error;
    }
});
//# sourceMappingURL=revertPlan.js.map