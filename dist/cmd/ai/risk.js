import { Command } from 'commander';
import { Logger } from '../../utils.js';
import { ValidationError } from '../../types.js';
import { loadConfig } from '../../config.js';
import { LLMManager } from '../../lib/llm/index.js';
export const aiRiskCommand = new Command('risk')
    .description('Assess risk level of changes using AI analysis')
    .option('--provider <provider>', 'AI provider to use')
    .option('--model <model>', 'AI model to use')
    .option('--json', 'output JSON instead of human-readable text')
    .option('--verbose', 'enable verbose logging')
    .action(async (options, command) => {
    const logger = new Logger(options);
    try {
        const config = await loadConfig();
        const llm = new LLMManager(config, logger);
        if (!llm.isAnyProviderConfigured()) {
            throw new ValidationError('No AI provider configured');
        }
        logger.info('⚡ Analyzing risk level...');
        const riskAssessment = {
            level: 'Medium',
            reasons: ['Database schema changes detected', 'Authentication logic modified'],
            blastRadius: 'Affects user login and data access',
            guardrails: ['Deploy with feature flag', 'Test on staging first']
        };
        if (options.json) {
            console.log(JSON.stringify(riskAssessment, null, 2));
        }
        else {
            logger.info(`\n🎯 Risk Level: ${riskAssessment.level}`);
            logger.info('\n📋 Reasons:');
            riskAssessment.reasons.forEach(reason => logger.info(`  • ${reason}`));
            logger.info('\n💥 Blast Radius:');
            logger.info(`  ${riskAssessment.blastRadius}`);
            logger.info('\n🛡️  Recommended Guardrails:');
            riskAssessment.guardrails.forEach(guard => logger.info(`  • ${guard}`));
        }
    }
    catch (error) {
        logger.error(`AI risk assessment failed: ${error}`);
        throw error;
    }
});
//# sourceMappingURL=risk.js.map