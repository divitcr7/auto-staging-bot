#!/usr/bin/env node
import { Command } from 'commander';
import { loadConfig } from './config.js';
import { Logger } from './utils.js';
import { GitOopsError } from './types.js';
// Import commands
import { wrongBranchCommand } from './cmd/wrongBranch.js';
import { splitCommand } from './cmd/split.js';
import { yankCommand } from './cmd/yank.js';
import { pocketCommand } from './cmd/pocket.js';
import { revertMergeCommand } from './cmd/revertMerge.js';
// Import AI commands
import { aiCommitCommand } from './cmd/ai/commit.js';
import { aiSplitCommand } from './cmd/ai/split.js';
import { aiReviewCommand } from './cmd/ai/review.js';
import { aiRiskCommand } from './cmd/ai/risk.js';
import { aiRevertPlanCommand } from './cmd/ai/revertPlan.js';
import { aiConflictsCommand } from './cmd/ai/conflicts.js';
import { aiMigrateSanityCommand } from './cmd/ai/migrateSanity.js';
const packageJson = await import('../package.json', { assert: { type: 'json' } });
async function main() {
    const program = new Command();
    program
        .name('git-oops')
        .description('A fast, safe, terminal-first Git helper with optional LLM features')
        .version(packageJson.default.version)
        .option('--verbose', 'enable verbose logging')
        .option('--no-color', 'disable colored output')
        .hook('preAction', async (thisCommand) => {
        // Load configuration
        try {
            const config = await loadConfig();
            thisCommand.setOptionValue('config', config);
        }
        catch (error) {
            const logger = new Logger({ noColor: thisCommand.opts().noColor });
            logger.error(`Failed to load configuration: ${error}`);
            process.exit(1);
        }
    });
    // Core commands
    program.addCommand(wrongBranchCommand);
    program.addCommand(splitCommand);
    program.addCommand(yankCommand);
    program.addCommand(pocketCommand);
    program.addCommand(revertMergeCommand);
    // AI commands
    const aiCommand = new Command('ai')
        .description('AI-assisted Git operations (requires provider configuration)')
        .addCommand(aiCommitCommand)
        .addCommand(aiSplitCommand)
        .addCommand(aiReviewCommand)
        .addCommand(aiRiskCommand)
        .addCommand(aiRevertPlanCommand)
        .addCommand(aiConflictsCommand)
        .addCommand(aiMigrateSanityCommand);
    program.addCommand(aiCommand);
    // Completion command
    program
        .command('completion')
        .description('Generate shell completion scripts')
        .argument('[shell]', 'shell type (bash, zsh, fish)', 'bash')
        .action((shell) => {
        generateCompletion(shell);
    });
    // Config command
    program
        .command('config')
        .description('Show current configuration')
        .option('--global', 'show global config only')
        .option('--local', 'show local config only')
        .action(async (options) => {
        try {
            const config = await loadConfig();
            const logger = new Logger(program.opts());
            logger.info('Current configuration:');
            console.log(JSON.stringify(config, null, 2));
        }
        catch (error) {
            const logger = new Logger(program.opts());
            logger.error(`Failed to load configuration: ${error}`);
            process.exit(1);
        }
    });
    // Safety tags management
    program
        .command('safety')
        .description('Manage safety tags created by git-oops')
        .option('--list', 'list all safety tags')
        .option('--cleanup [days]', 'cleanup tags older than N days (default: 30)', '30')
        .action(async (options) => {
        const { Git } = await import('./lib/git.js');
        const { SafetyManager } = await import('./lib/safety.js');
        const logger = new Logger(program.opts());
        const git = new Git(logger);
        const safety = new SafetyManager(git, logger);
        try {
            if (options.list) {
                const tags = await safety.listSafetyTags();
                if (tags.length === 0) {
                    logger.info('No safety tags found');
                }
                else {
                    logger.info(`Found ${tags.length} safety tags:`);
                    for (const tag of tags) {
                        console.log(`  ${tag.name} (${tag.timestamp})`);
                    }
                }
            }
            else if (options.cleanup) {
                const days = parseInt(options.cleanup, 10);
                const deleted = await safety.cleanupOldSafetyTags(days);
                logger.success(`Cleaned up ${deleted} old safety tags`);
            }
            else {
                logger.error('Use --list or --cleanup');
                process.exit(1);
            }
        }
        catch (error) {
            handleError(error, logger);
        }
    });
    // Error handling
    program.exitOverride();
    try {
        await program.parseAsync();
    }
    catch (error) {
        const logger = new Logger({ noColor: process.env.NO_COLOR === '1' });
        if (error.code === 'commander.help' || error.code === 'commander.helpDisplayed') {
            process.exit(0);
        }
        if (error.code === 'commander.version') {
            process.exit(0);
        }
        handleError(error, logger);
    }
}
function handleError(error, logger) {
    if (error instanceof GitOopsError) {
        logger.error(error.message);
        if (error.cause && logger.options?.verbose) {
            logger.verbose(`Caused by: ${error.cause.message}`);
        }
        process.exit(error.code);
    }
    else {
        logger.error(`Unexpected error: ${error.message || error}`);
        if (logger.options?.verbose && error.stack) {
            console.error(error.stack);
        }
        process.exit(1);
    }
}
function generateCompletion(shell) {
    const completions = {
        bash: `
_git_oops() {
    local cur prev opts
    COMPREPLY=()
    cur="\${COMP_WORDS[COMP_CWORD]}"
    prev="\${COMP_WORDS[COMP_CWORD-1]}"
    
    opts="wrong-branch split yank pocket revert-merge ai config safety completion --help --version --verbose --no-color"
    
    if [[ \${cur} == -* ]] ; then
        COMPREPLY=( $(compgen -W "\${opts}" -- \${cur}) )
        return 0
    fi
    
    case "\${prev}" in
        git-oops)
            COMPREPLY=( $(compgen -W "wrong-branch split yank pocket revert-merge ai config safety completion" -- \${cur}) )
            ;;
        ai)
            COMPREPLY=( $(compgen -W "commit split review risk revert-plan conflicts migrate-sanity" -- \${cur}) )
            ;;
        *)
            ;;
    esac
}

complete -F _git_oops git-oops
`,
        zsh: `
#compdef git-oops

_git_oops() {
  local context state line
  
  _arguments -C \\
    '--help[Show help information]' \\
    '--version[Show version information]' \\
    '--verbose[Enable verbose logging]' \\
    '--no-color[Disable colored output]' \\
    '1: :->commands' \\
    '*: :->args'
    
  case $state in
    commands)
      _values 'git-oops commands' \\
        'wrong-branch[Move commits to new branch]' \\
        'split[Split staged changes by directory]' \\
        'yank[Pull with dirty work]' \\
        'pocket[Save working state to hidden ref]' \\
        'revert-merge[Safely revert merge commit]' \\
        'ai[AI-assisted operations]' \\
        'config[Show configuration]' \\
        'safety[Manage safety tags]' \\
        'completion[Generate completions]'
      ;;
    args)
      case $line[1] in
        ai)
          _values 'ai commands' \\
            'commit[Generate commit message]' \\
            'split[Smart split by semantics]' \\
            'review[Generate PR description]' \\
            'risk[Assess change risk]' \\
            'revert-plan[Plan safe revert]' \\
            'conflicts[Resolve merge conflicts]' \\
            'migrate-sanity[Check migration safety]'
          ;;
      esac
      ;;
  esac
}

_git_oops "$@"
`,
        fish: `
complete -c git-oops -f -a "wrong-branch" -d "Move commits to new branch"
complete -c git-oops -f -a "split" -d "Split staged changes by directory"
complete -c git-oops -f -a "yank" -d "Pull with dirty work"
complete -c git-oops -f -a "pocket" -d "Save working state to hidden ref"
complete -c git-oops -f -a "revert-merge" -d "Safely revert merge commit"
complete -c git-oops -f -a "ai" -d "AI-assisted operations"
complete -c git-oops -f -a "config" -d "Show configuration"
complete -c git-oops -f -a "safety" -d "Manage safety tags"
complete -c git-oops -f -a "completion" -d "Generate completions"

complete -c git-oops -l help -d "Show help information"
complete -c git-oops -l version -d "Show version information"
complete -c git-oops -l verbose -d "Enable verbose logging"
complete -c git-oops -l no-color -d "Disable colored output"

# AI subcommands
complete -c git-oops -f -n "__fish_seen_subcommand_from ai" -a "commit" -d "Generate commit message"
complete -c git-oops -f -n "__fish_seen_subcommand_from ai" -a "split" -d "Smart split by semantics"
complete -c git-oops -f -n "__fish_seen_subcommand_from ai" -a "review" -d "Generate PR description"
complete -c git-oops -f -n "__fish_seen_subcommand_from ai" -a "risk" -d "Assess change risk"
complete -c git-oops -f -n "__fish_seen_subcommand_from ai" -a "revert-plan" -d "Plan safe revert"
complete -c git-oops -f -n "__fish_seen_subcommand_from ai" -a "conflicts" -d "Resolve merge conflicts"
complete -c git-oops -f -n "__fish_seen_subcommand_from ai" -a "migrate-sanity" -d "Check migration safety"
`,
    };
    const completion = completions[shell];
    if (!completion) {
        console.error(`Unsupported shell: ${shell}`);
        console.error('Supported shells: bash, zsh, fish');
        process.exit(1);
    }
    console.log(completion.trim());
    console.error(`\n# To enable completion, add this to your shell configuration:`);
    switch (shell) {
        case 'bash':
            console.error(`# echo 'eval "$(git-oops completion bash)"' >> ~/.bashrc`);
            break;
        case 'zsh':
            console.error(`# echo 'eval "$(git-oops completion zsh)"' >> ~/.zshrc`);
            break;
        case 'fish':
            console.error(`# git-oops completion fish > ~/.config/fish/completions/git-oops.fish`);
            break;
    }
}
// Handle unhandled rejections and exceptions
process.on('unhandledRejection', (reason) => {
    const logger = new Logger({ noColor: process.env.NO_COLOR === '1' });
    logger.error(`Unhandled rejection: ${reason}`);
    process.exit(1);
});
process.on('uncaughtException', (error) => {
    const logger = new Logger({ noColor: process.env.NO_COLOR === '1' });
    logger.error(`Uncaught exception: ${error.message}`);
    if (process.env.NODE_ENV === 'development') {
        console.error(error.stack);
    }
    process.exit(1);
});
// Run main function
main().catch((error) => {
    const logger = new Logger({ noColor: process.env.NO_COLOR === '1' });
    handleError(error, logger);
});
//# sourceMappingURL=cli.js.map