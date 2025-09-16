import chalk from "chalk";
import { Command } from "commander";

interface CommandHelp {
  name: string;
  description: string;
  longDescription: string;
  usage: string[];
  examples: Array<{
    command: string;
    description: string;
  }>;
  options?: Array<{
    flag: string;
    description: string;
  }>;
}

const commandsHelp: Record<string, CommandHelp> = {
  "wrong-branch": {
    name: "wrong-branch",
    description: "Move commits to new branch, reset current branch to upstream",
    longDescription: `
🔄 Made commits on the wrong branch? This command safely moves your unique commits
to a new branch and resets your current branch back to match upstream/origin.

Perfect for when you:
• Started working on main/master instead of a feature branch
• Committed to the wrong feature branch
• Need to clean up your branch history

Safety features:
• Creates backup tags before any destructive operations
• Warns about protected branches (main/master/develop)
• Shows you exactly what will happen before doing it`,
    usage: [
      "git oops wrong-branch [new-branch-name]",
      "git oops wrong-branch feature/my-fix",
      "git oops wrong-branch --dry-run",
    ],
    examples: [
      {
        command: "git oops wrong-branch feature/auth-fix",
        description: "Move commits to new branch 'feature/auth-fix'",
      },
      {
        command: "git oops wrong-branch",
        description: "Interactive mode - will prompt for branch name",
      },
      {
        command: "git oops wrong-branch --dry-run",
        description: "See what would happen without making changes",
      },
    ],
    options: [
      {
        flag: "--dry-run",
        description: "Show what would be done without executing",
      },
      {
        flag: "--yes",
        description: "Skip confirmation prompts",
      },
      {
        flag: "--verbose",
        description: "Enable verbose logging",
      },
    ],
  },
  split: {
    name: "split",
    description: "Split staged changes into separate commits by directory",
    longDescription: `
📁 Split your messy staged changes into clean, organized commits automatically!
Groups files by their top-level directory and creates separate commits for each.

Perfect for when you:
• Made changes across multiple components/modules
• Want to organize commits by feature area
• Need to separate frontend/backend changes
• Follow conventional commit practices

The tool intelligently groups files and suggests meaningful commit messages
for each directory, making your Git history clean and reviewable.`,
    usage: [
      "git oops split",
      "git oops split --dry-run",
      "git oops split --yes",
    ],
    examples: [
      {
        command: "git add .; git oops split",
        description: "Stage all changes and split them by directory",
      },
      {
        command: "git oops split --dry-run",
        description: "Preview how files would be grouped",
      },
      {
        command: "git oops split --yes",
        description: "Split without confirmation prompts",
      },
    ],
    options: [
      {
        flag: "--dry-run",
        description: "Show what would be done without executing",
      },
      {
        flag: "--yes",
        description: "Skip confirmation prompts",
      },
      {
        flag: "--verbose",
        description: "Enable verbose logging",
      },
    ],
  },
  yank: {
    name: "yank",
    description: "Stash changes, pull latest, restore changes safely",
    longDescription: `
🔄 Safely update your branch with latest changes from remote while preserving
your local work. This is like 'git pull --rebase' but with better safety and
conflict handling.

The process:
1. Stashes your current changes (staged + unstaged)
2. Pulls latest changes from upstream
3. Attempts to restore your changes
4. Handles conflicts gracefully with clear instructions

Perfect for:
• Getting latest changes before pushing
• Resolving "would be overwritten by merge" errors
• Daily workflow to stay up to date`,
    usage: ["git oops yank", "git oops yank --dry-run"],
    examples: [
      {
        command: "git oops yank",
        description: "Stash, pull, and restore your changes",
      },
      {
        command: "git oops yank --dry-run",
        description: "See what would happen without making changes",
      },
    ],
    options: [
      {
        flag: "--yes",
        description: "Skip confirmation prompts",
      },
      {
        flag: "--verbose",
        description: "Enable verbose logging",
      },
    ],
  },
  pocket: {
    name: "pocket",
    description: "Save working state to hidden refs, optionally push",
    longDescription: `
💾 Create a complete snapshot of your current working state and save it to
a hidden Git ref. This preserves your exact state and can even be pushed
for backup without triggering CI.

Features:
• Saves complete working state (staged, unstaged, untracked)
• Creates refs at refs/pocket/branch-name
• Optionally push to remote for backup
• Doesn't trigger CI/CD (uses hidden refs)
• Cleans working directory after saving

Perfect for:
• Creating quick backups before risky operations
• Sharing WIP state with teammates
• Context switching between features
• Creating checkpoints during development`,
    usage: [
      "git oops pocket",
      "git oops pocket --push",
      "git oops pocket --push origin",
    ],
    examples: [
      {
        command: "git oops pocket",
        description: "Save current state locally and clean directory",
      },
      {
        command: "git oops pocket --push",
        description: "Save and push to origin remote for backup",
      },
      {
        command: "git oops pocket --push upstream",
        description: "Save and push to specific remote",
      },
    ],
    options: [
      {
        flag: "--push [remote]",
        description: "Push pocket ref to remote (default: origin)",
      },
      {
        flag: "--yes",
        description: "Skip confirmation prompts",
      },
      {
        flag: "--verbose",
        description: "Enable verbose logging",
      },
    ],
  },
  "revert-merge": {
    name: "revert-merge",
    description: "Safely revert merge commits with checks and backups",
    longDescription: `
↩️  Safely revert merge commits without breaking your repository. This wraps
'git revert -m 1' with safety checks, validation, and clear explanations
of what's happening.

Why this is safer than raw 'git revert':
• Validates the commit is actually a merge
• Explains mainline selection (which parent to revert to)
• Creates backup tags before reverting
• Shows impact analysis
• Handles multi-parent merges correctly

Perfect for:
• Reverting problematic feature merges
• Rolling back broken releases
• Undoing accidental merges`,
    usage: [
      "git oops revert-merge <merge-sha>",
      "git oops revert-merge abc1234",
      "git oops revert-merge abc1234 --mainline 2",
    ],
    examples: [
      {
        command: "git oops revert-merge abc1234",
        description: "Revert merge commit abc1234",
      },
      {
        command: "git oops revert-merge abc1234 --dry-run",
        description: "Preview what would be reverted",
      },
      {
        command: "git oops revert-merge abc1234 -m 2",
        description: "Revert to the second parent instead of first",
      },
    ],
    options: [
      {
        flag: "-m, --mainline <parent>",
        description: "Parent number to revert to (default: 1)",
      },
      {
        flag: "--dry-run",
        description: "Show what would be done without executing",
      },
      {
        flag: "--yes",
        description: "Skip confirmation prompts",
      },
      {
        flag: "--verbose",
        description: "Enable verbose logging",
      },
    ],
  },
  undo: {
    name: "undo",
    description: "Undo commits but keep changes in working directory",
    longDescription: `
↶  Undo recent commits while keeping all your changes in the working directory.
This is like 'git reset --soft HEAD~N' but with safety checks and better UX.

What it does:
• Moves HEAD back by N commits
• Keeps all changes from undone commits in working directory
• Creates backup tags so you can restore if needed
• Warns about pushed commits
• Shows exactly what will be undone

Perfect for:
• Fixing commit messages or splitting commits
• Undoing accidental commits
• Reorganizing recent history
• Preparing for interactive rebase`,
    usage: ["git oops undo", "git oops undo -n 3", "git oops undo --dry-run"],
    examples: [
      {
        command: "git oops undo",
        description: "Undo the last commit (keep changes)",
      },
      {
        command: "git oops undo -n 3",
        description: "Undo last 3 commits (keep all changes)",
      },
      {
        command: "git oops undo --dry-run",
        description: "See which commits would be undone",
      },
    ],
    options: [
      {
        flag: "-n, --commits <number>",
        description: "Number of commits to undo (default: 1)",
      },
      {
        flag: "--dry-run",
        description: "Show what would be done without executing",
      },
      {
        flag: "--yes",
        description: "Skip confirmation prompts",
      },
      {
        flag: "--verbose",
        description: "Enable verbose logging",
      },
    ],
  },
  fixup: {
    name: "fixup",
    description: "Fix the last commit with current changes",
    longDescription: `
🔧 Amend the last commit with your current staged changes. This is like
'git commit --amend' but with better safety checks and options.

What it does:
• Adds staged changes to the last commit
• Optionally updates the commit message
• Warns if the commit has been pushed
• Shows before/after comparison
• Creates backup tags for safety

Perfect for:
• Fixing typos or small bugs in recent commits
• Adding forgotten files to the last commit
• Updating commit messages
• Cleaning up work before pushing`,
    usage: [
      "git oops fixup",
      'git oops fixup -m "Better commit message"',
      "git oops fixup --no-edit",
    ],
    examples: [
      {
        command: "git add .; git oops fixup",
        description: "Add current changes to last commit",
      },
      {
        command: 'git oops fixup -m "Fix typo in README"',
        description: "Amend last commit with new message",
      },
      {
        command: "git oops fixup --dry-run",
        description: "Preview what would be amended",
      },
    ],
    options: [
      {
        flag: "-m, --message <message>",
        description: "New commit message for the amendment",
      },
      {
        flag: "--dry-run",
        description: "Show what would be done without executing",
      },
      {
        flag: "--yes",
        description: "Skip confirmation prompts",
      },
      {
        flag: "--verbose",
        description: "Enable verbose logging",
      },
    ],
  },
  save: {
    name: "save",
    description: "Quickly save all changes with a commit",
    longDescription: `
💾 Quickly save all your work (staged, unstaged, and untracked files) with
a single command. This is like 'git add -A && git commit -m "WIP"' but with
better UX and options.

What it does:
• Stages ALL files (including untracked)
• Creates a commit with your message
• Shows you exactly what's being saved
• Provides helpful next steps
• Safe for quick checkpoints

Perfect for:
• Quick work-in-progress saves
• End-of-day checkpoints
• Before switching contexts
• Creating safe points before experiments`,
    usage: [
      "git oops save",
      'git oops save -m "WIP: working on auth"',
      "git oops save --yes",
    ],
    examples: [
      {
        command: "git oops save",
        description: "Save all changes with default WIP message",
      },
      {
        command: 'git oops save -m "Feature: user login complete"',
        description: "Save with custom commit message",
      },
      {
        command: "git oops save --yes",
        description: "Save without confirmation prompt",
      },
    ],
    options: [
      {
        flag: "-m, --message <message>",
        description: "Commit message (default: 'WIP: quick save')",
      },
      {
        flag: "--yes",
        description: "Skip confirmation prompts",
      },
      {
        flag: "--verbose",
        description: "Enable verbose logging",
      },
    ],
  },
};

export function formatMainHelp(program: Command): string {
  const version = program.version() || "unknown";

  return `
${chalk.green.bold("git-oops")} ${chalk.gray(`v${version}`)} ${chalk.yellow(
    "— CLI for real-world Git disasters"
  )}

${chalk.cyan.bold("DESCRIPTION")}
  One-liners for everyday Git mistakes. Move accidental commits off main,
  split mixed changes, yank safely, checkpoint WIP, and more.
  
  ${chalk.gray(
    "Non-destructive by default. Safety tags before risky operations."
  )}

${chalk.cyan.bold("USAGE")}
  ${chalk.white("git oops")} ${chalk.yellow("<command>")} ${chalk.gray(
    "[options]"
  )}

${chalk.cyan.bold("COMMANDS")}
${Object.values(commandsHelp)
  .map(
    (cmd) =>
      `  ${chalk.white(cmd.name.padEnd(15))} ${chalk.gray(cmd.description)}`
  )
  .join("\n")}

${chalk.cyan.bold("GLOBAL OPTIONS")}
  ${chalk.white("--help")}                Show help for any command
  ${chalk.white("--version")}             Show version
  ${chalk.white("--verbose")}             Enable verbose logging
  ${chalk.white("--no-color")}            Disable colored output

${chalk.cyan.bold("EXAMPLES")}
  ${chalk.white("git oops wrong-branch feature/fix")}   ${chalk.gray(
    "Move commits to new branch"
  )}
  ${chalk.white("git oops split --dry-run")}            ${chalk.gray(
    "Preview how staged files would be split"
  )}
  ${chalk.white("git oops yank")}                       ${chalk.gray(
    "Stash, pull, restore safely"
  )}
  ${chalk.white('git oops save -m "checkpoint"')}       ${chalk.gray(
    "Quick save all changes"
  )}

${chalk.cyan.bold("SAFETY FEATURES")}
  • ${chalk.green("Backup tags")} before destructive operations (${chalk.gray(
    "oops-backup-TIMESTAMP"
  )})
  • ${chalk.green("Protected branch")} detection (main/master/develop)
  • ${chalk.green("Dry run mode")} available for all commands (${chalk.gray(
    "--dry-run"
  )})
  • ${chalk.green("Push detection")} warns about rewriting pushed commits

${chalk.cyan.bold("GETTING HELP")}
  ${chalk.white("git oops <command> --help")}          ${chalk.gray(
    "Detailed help for specific command"
  )}
  ${chalk.white("git oops wrong-branch --help")}       ${chalk.gray(
    "Example: help for wrong-branch"
  )}

${chalk.gray("For more info: https://git-oops.dev")}
`;
}

export function formatCommandHelp(commandName: string): string {
  const cmd = commandsHelp[commandName];
  if (!cmd) {
    return chalk.red(`Unknown command: ${commandName}`);
  }

  return `
${chalk.green.bold("git oops " + cmd.name)} ${chalk.yellow(
    "— " + cmd.description
  )}

${chalk.cyan.bold("DESCRIPTION")}${cmd.longDescription}

${chalk.cyan.bold("USAGE")}
${cmd.usage.map((usage) => `  ${chalk.white(usage)}`).join("\n")}

${
  cmd.options
    ? `${chalk.cyan.bold("OPTIONS")}
${cmd.options
  .map(
    (opt) =>
      `  ${chalk.white(opt.flag.padEnd(20))} ${chalk.gray(opt.description)}`
  )
  .join("\n")}

`
    : ""
}${chalk.cyan.bold("EXAMPLES")}
${cmd.examples
  .map(
    (ex) =>
      `  ${chalk.white(ex.command)}
  ${chalk.gray("→ " + ex.description)}`
  )
  .join("\n\n")}

${chalk.cyan.bold("SAFETY")}
  • Creates backup tags before destructive operations
  • Use ${chalk.white("--dry-run")} to preview changes without executing
  • Use ${chalk.white("--verbose")} for detailed logging

${chalk.gray("For more examples: https://git-oops.dev")}
`;
}

export function addCustomHelp(program: Command) {
  // Override the default help for the main program
  program.configureHelp({
    formatHelp: (cmd, helper) => {
      if (cmd.name() === "git-oops") {
        return formatMainHelp(cmd);
      }

      const commandName = cmd.name();
      if (commandsHelp[commandName]) {
        return formatCommandHelp(commandName);
      }

      // Fallback to default
      return helper.formatHelp(cmd, helper);
    },
  });

  // Add help command
  program
    .command("help")
    .description("Show detailed help")
    .argument("[command]", "command to show help for")
    .action((command) => {
      if (command && commandsHelp[command]) {
        console.log(formatCommandHelp(command));
      } else if (command) {
        console.log(chalk.red(`Unknown command: ${command}`));
        console.log(formatMainHelp(program));
      } else {
        console.log(formatMainHelp(program));
      }
    });
}

export function addCustomHelpToCommand(command: Command) {
  const commandName = command.name();
  if (commandsHelp[commandName]) {
    command.configureHelp({
      formatHelp: () => formatCommandHelp(commandName),
    });
  }
}
