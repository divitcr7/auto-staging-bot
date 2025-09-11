# Staged Git Commit Bot

A sophisticated bot that creates realistic Git commit history by analyzing a source project and executing commits over multiple days, simulating professional engineering workflow.

## Features

- **LLM Planning**: Analyzes source code and creates realistic commit plans
- **Conventional Commits**: Uses proper commit message format with types and scopes  
- **Atomic Commits**: Creates focused, single-purpose commits
- **Time-based Execution**: Spreads commits across multiple days with time limits
- **Security Hygiene**: Automatically excludes sensitive files and build artifacts
- **Manual/Auto Modes**: Supports both manual approval and automated execution
- **Resumable**: Can pause and resume execution across sessions
- **Git Integration**: Full Git workflow with staging, committing, and optional pushing

## Requirements

- **Node.js ≥ 18.0.0** (mandatory)
- Git repository (target directory must be a clean Git working tree)
- Source project to analyze

## Installation

```bash
git clone <repository>
cd auto-staging-bot
npm install
```

## Usage

### Basic Usage

```bash
# Using command line arguments
node commit-bot.js /path/to/source/project /path/to/target/repo 5 3

# Using environment variables
SOURCE_DIR=/path/to/source/project \
TARGET_REPO_DIR=/path/to/target/repo \
TOTAL_DAYS=5 \
COMMITS_PER_DAY=3 \
node commit-bot.js
```

### Configuration Options

All configuration can be set via environment variables or command line arguments:

| Variable | CLI Arg | Default | Description |
|----------|---------|---------|-------------|
| `SOURCE_DIR` | 1st arg | - | **Required**: Source project directory to analyze |
| `TARGET_REPO_DIR` | 2nd arg | `cwd` | Target Git repository directory |
| `TOTAL_DAYS` | 3rd arg | `5` | Number of days to spread commits across |
| `COMMITS_PER_DAY` | 4th arg | `3` | Maximum commits per day |
| `DAILY_RUN_HOURS` | - | `3` | Time budget per daily run (hours) |
| `TIMEZONE` | - | `America/Chicago` | Timezone for commits |
| `PUSH_MODE` | - | `manual` | `manual` or `auto` push mode |
| `COMMIT_MODE` | - | `manual` | `manual` or `auto` commit confirmation |
| `DRY_RUN` | - | `false` | Preview mode without actual commits |
| `MAX_FILES_PER_COMMIT` | - | auto | Maximum files per commit |
| `SKIP_PATTERNS` | - | `[]` | Comma-separated glob patterns to skip |
| `PROJECT_ID` | - | auto | Stable ID for project artifacts |
| `AUTHOR_NAME` | - | - | Git author name |
| `AUTHOR_EMAIL` | - | - | Git author email |
| `REVIEW_MODE` | - | `ask` | `ask`, `force`, or `skip` plan review |

### Example with Environment Variables

```bash
export SOURCE_DIR="/path/to/my-react-app"
export TARGET_REPO_DIR="/path/to/new-repo"
export TOTAL_DAYS=10
export COMMITS_PER_DAY=2
export AUTHOR_NAME="John Developer"
export AUTHOR_EMAIL="john@example.com"
export COMMIT_MODE="auto"
export PUSH_MODE="manual"

node commit-bot.js
```

## Workflow

### Phase 0: Environment Setup
- Validates Node.js version (≥18.0.0)
- Verifies source and target directories
- Ensures target is a clean Git repository
- Loads `.gitignore` rules and skip patterns

### Phase 1: Planning (LLM)
- Scans source directory respecting ignore rules
- Clusters files by feature/domain
- Creates realistic commit sequence following best practices:
  - Scaffold & metadata → Build/config/CI → Skeleton → Features → Tests → Docs → Assets
- Generates conventional commit messages
- Creates `.commit-plan.json`, `.commit-state.json`, and `PREVIEW.md`

### Phase 2: Review & Edit (Optional)
- Shows plan summary with commit subjects
- Allows editing commit messages and basic restructuring
- Validates changes and updates plan
- Requires approval before execution

### Phase 3: Daily Execution
- Loads approved plan and execution state
- Copies files from source to target with integrity checks
- Creates commits with proper authorship and timestamps
- Respects daily time limits and commit quotas
- Supports manual confirmation for each commit
- Maintains execution state for resumability

### Phase 4: Finish
- Verifies all planned commits are complete
- Optionally pushes to remote (if configured)
- Provides completion confirmation

## File Artifacts

The bot creates several files in the target repository:

- **`.commit-plan.json`**: Complete execution plan with all commit details
- **`.commit-state.json`**: Progress tracking and resumption state  
- **`PREVIEW.md`**: Human-readable summary of planned commits
- **`.commit-bot.log`**: Detailed execution log with timestamps

*Note: These files are recommended to be added to `.gitignore`*

## Security Features

The bot automatically excludes sensitive and build files:
- Environment files (`.env*`)
- Private keys (`*.pem`, `*.key`, `id_*`, etc.)
- Build outputs (`node_modules`, `dist`, `build`, `.next`, etc.)
- Temporary files (`*.bak`, `.cache`, `.turbo`, etc.)

## Best Practices

1. **Clean Target**: Always start with a clean Git working tree
2. **Review Plans**: Review the generated plan before approval
3. **Manual Mode**: Use manual commit mode for sensitive projects
4. **Backup Source**: Ensure source project is backed up
5. **Test Run**: Use `DRY_RUN=true` for initial testing

## Troubleshooting

### Common Issues

**"HALT: S0.1 — Node v18+ required"**
- Upgrade Node.js to version 18.0.0 or higher

**"HALT: S0.3 — Target working tree not clean"**
- Commit or stash changes in target repository
- Or run `git reset --hard` if safe to do so

**"HALT: S3.0 — Plan not approved"**
- Run the bot again to complete the review/approval process

**"No more work to do"**
- All planned commits completed successfully
- Check `.commit-state.json` for execution history

### Resume Execution

The bot automatically resumes from where it left off. To restart from scratch:

```bash
# Remove artifacts and restart planning
rm .commit-plan.json .commit-state.json PREVIEW.md .commit-bot.log
node commit-bot.js
```

## Development

```bash
# Install dependencies
npm install

# Run with debugging
DEBUG=1 node commit-bot.js

# Test with dry run
DRY_RUN=true node commit-bot.js /path/to/source
```

## License

MIT License - see LICENSE file for details.
