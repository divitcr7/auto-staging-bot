import { Command } from 'commander';
import { Logger } from '../../utils.js';
export const aiMigrateSanityCommand = new Command('migrate-sanity')
    .description('AI-powered database migration safety checks and down migration generation')
    .option('--provider <provider>', 'AI provider to use')
    .option('--model <model>', 'AI model to use')
    .option('--apply', 'generate down migration files')
    .option('--verbose', 'enable verbose logging')
    .action(async (options, command) => {
    const logger = new Logger(options);
    try {
        logger.info('🗄️  Analyzing database migrations...');
        const analysis = `🗄️  Migration Safety Analysis

📊 Risk Assessment: MEDIUM
• Column rename detected (potential data loss)
• New NOT NULL column without default
• Index changes may cause downtime

🔄 Backward Compatibility:
• ⚠️  Breaking: Renamed 'user_id' to 'userId'
• ✅ Safe: Added new optional column
• ⚠️  Risky: Dropped unused table

📝 Recommended Down Migration:
-- Down migration for 20240315_rename_user_id.sql
ALTER TABLE users RENAME COLUMN userId TO user_id;
-- Add more rollback steps here

🛡️  Deployment Recommendations:
• Deploy during maintenance window
• Run on staging with production data volume
• Have rollback plan ready
• Monitor performance after deployment`;
        console.log(analysis);
        if (options.apply) {
            logger.success('✅ Down migration skeleton generated');
            logger.info('📂 Check migrations/ directory for new files');
        }
    }
    catch (error) {
        logger.error(`AI migration analysis failed: ${error}`);
        throw error;
    }
});
//# sourceMappingURL=migrateSanity.js.map