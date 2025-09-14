# git-oops

[![CI](https://github.com/your-org/git-oops/workflows/CI/badge.svg)](https://github.com/your-org/git-oops/actions)
[![npm version](https://badge.fury.io/js/git-oops.svg)](https://www.npmjs.com/package/git-oops)

A fast, safe, terminal-first Git helper with optional LLM features. Designed to solve real-world Git pain points with zero surprises and maximum safety.

## Why git-oops?

We've all been there:
- 😱 Committed on `main` instead of a feature branch
- 🤦‍♀️ Mixed unrelated changes in one commit
- 🙄 Dirty working directory blocking a pull
- 🔄 Need to revert a merge but scared of breaking things
- 🤖 Want AI help with commits but worried about security

**git-oops** solves these problems with surgical precision and built-in safety nets.

## Installation

```bash
# Install globally
npm install -g git-oops

# Or use without installing
npx git-oops@latest <command>
```

After installation, you can use either:
- `git-oops <command>` 
- `git oops <command>` (Git auto-discovers the binary)

## Quick Start

```bash
# Committed on wrong branch? Move commits to new branch
git oops wrong-branch feature/fix-login

# Mixed changes staged? Split by directory  
git oops split

# Dirty work blocking pull? Stash, pull, restore
git oops yank

# Save work-in-progress to hidden ref
git oops pocket --push

# Safely revert a merge commit
git oops revert-merge abc1234

# AI-powered commit messages (requires setup)
git oops ai commit --apply
```

## Core Commands

### `wrong-branch [new-branch]`
**Problem**: Committed on protected branch, need to move commits elsewhere

```bash
# Auto-generate branch name from last commit
git oops wrong-branch

# Specify branch name  
git oops wrong-branch feature/user-auth

# See what would happen
git oops wrong-branch --dry-run
```

**What it does**:
1. Creates safety tag at current HEAD
2. Creates new branch with your commits
3. Resets current branch to upstream
4. Switches to new branch

**Safety**: Always creates backup tags, warns about protected branches

---

### `split`
**Problem**: Staged changes mix features, tests, docs in one commit

```bash
git oops split            # Split by top-level directory
git oops split --dry-run  # Preview the plan
```

**What it does**:
1. Groups staged files by directory (`src/`, `tests/`, `docs/`, root)
2. Creates separate commits for each group
3. Uses conventional commit messages

**Example**:
```
# Before: 15 staged files
# After: 3 commits
chore(src): split from mixed changes
chore(tests): split from mixed changes  
chore(docs): split from mixed changes
```

---

### `yank`
**Problem**: Want to pull but have uncommitted work

```bash
git oops yank
```

**What it does**:
1. Stashes dirty work (including untracked files)
2. Pulls with rebase
3. Restores stashed changes
4. Handles conflicts gracefully (preserves stash)

**Safety**: Never loses your work, even on conflicts

---

### `pocket [--push [remote]]`
**Problem**: Need to save exact working state somewhere safe

```bash
git oops pocket           # Save locally
git oops pocket --push    # Save and push to origin
git oops pocket --push upstream  # Push to specific remote
```

**What it does**:
1. Creates stash of all changes (staged + unstaged + untracked)
2. Saves to hidden ref `refs/pocket/<branch>`
3. Optionally pushes for access from other machines

**Access saved state**:
```bash
# On another machine
git fetch origin refs/pocket/main
git switch -c pocket/main FETCH_HEAD
```

---

### `revert-merge <merge-sha>`
**Problem**: Need to safely revert a merge commit

```bash
git oops revert-merge abc1234
git oops revert-merge abc1234 --mainline 2  # Specify parent
```

**What it does**:
1. Validates it's actually a merge commit
2. Creates safety tag
3. Shows what commits would be affected
4. Performs revert with proper mainline
5. Guides through conflicts if any

## AI Commands

> 🔒 **Privacy First**: All AI commands include automatic secret redaction and content filtering

### Setup

Configure an AI provider:

```bash
# OpenAI
export OOPS_OPENAI_API_KEY="sk-..."

# Anthropic  
export OOPS_ANTHROPIC_API_KEY="claude-..."

# Azure OpenAI
export OOPS_AZURE_OPENAI_ENDPOINT="https://your-resource.openai.azure.com/"
export OOPS_AZURE_OPENAI_API_KEY="..."

# Ollama (local)
export OOPS_OLLAMA_ENDPOINT="http://localhost:11434"
```

### `ai commit`
**Generate conventional commit messages from staged changes**

```bash
git oops ai commit              # Preview message
git oops ai commit --apply      # Commit immediately
git oops ai commit --json       # Machine-readable output
```

**Example output**:
```
feat(auth): add OAuth2 integration with Google

- Implement OAuth2 flow for Google authentication
- Add user profile sync from Google APIs  
- Update login UI with Google sign-in button
- Add environment variables for OAuth config

Closes #123
```

---

### `ai split`
**Semantically split changes (smarter than directory-based)**

```bash
git oops ai split               # Show plan
git oops ai split --apply       # Execute plan
git oops ai split --json        # JSON output
```

Groups by semantic meaning: features, tests, docs, migrations, config

---

### `ai review`
**Generate PR descriptions and review guidance**

```bash
git oops ai review              # Print to stdout
git oops ai review --output pr.md  # Save to file
```

**Output includes**:
- What changed and why
- Risk assessment
- Manual testing plan
- Release notes

---

### `ai risk`
**Assess change risk level**

```bash
git oops ai risk
git oops ai risk --json
```

**Output**:
- Risk level (Low/Medium/High)
- Specific concerns
- Blast radius assessment
- Recommended guardrails

---

### `ai conflicts`
**Get help resolving merge conflicts**

```bash
git oops ai conflicts           # Show suggestions
git oops ai conflicts --apply   # Auto-apply patches
```

Analyzes only conflict markers, suggests minimal resolutions

---

### `ai revert-plan <sha>`
**Plan safe revert strategy**

```bash
git oops ai revert-plan abc1234
```

Provides step-by-step revert plan with considerations for:
- Database migrations
- Feature flags
- Dependent changes

---

### `ai migrate-sanity`
**Database migration safety checks**

```bash
git oops ai migrate-sanity
git oops ai migrate-sanity --apply  # Generate down migrations
```

- Risk assessment for schema changes
- Backward compatibility analysis  
- Generates down migration skeletons

## Configuration

### Config Files

Create `.git-oopsrc.json` in your repo or `~/.git-oopsrc.json` globally:

```json
{
  "provider": "openai",
  "model": "gpt-4",
  "maxKb": 96,
  "telemetry": false,
  "alwaysIsolate": ["*.sql", "migrations/**"],
  "commitStyle": "conventional"
}
```

### Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `OOPS_PROVIDER` | AI provider | none |
| `OOPS_MODEL` | AI model | provider default |
| `OOPS_MAX_KB` | Max diff size for AI | 96 |
| `OOPS_OPENAI_API_KEY` | OpenAI API key | none |
| `OOPS_ANTHROPIC_API_KEY` | Anthropic API key | none |
| `OOPS_AZURE_OPENAI_ENDPOINT` | Azure endpoint | none |
| `OOPS_AZURE_OPENAI_API_KEY` | Azure API key | none |
| `OOPS_OLLAMA_ENDPOINT` | Ollama endpoint | http://localhost:11434 |

## Security & Privacy

### Automatic Redaction

AI commands automatically filter out:
- **Files**: `.env`, `.key`, `.pem`, `.aws/*`, `id_rsa*`, etc.
- **Patterns**: API keys, passwords, tokens, private keys, SSNs, credit cards
- **Size limits**: Truncates large diffs to prevent token exhaustion

### View What's Sent

```bash
git oops ai commit --print-redactions
```

Shows exactly what was filtered/redacted before sending to AI.

### Offline First

All core commands work without AI configured. AI commands gracefully degrade with helpful error messages.

## Safety Guarantees

### Automatic Backups

Every destructive operation creates a safety tag:

```bash
# List safety tags
git oops safety --list

# Cleanup old tags  
git oops safety --cleanup 30

# Manual recovery
git checkout -b recovery safety-tag-name
```

### Protection Checks

- Warns on protected branches (`main`, `master`, `release/*`)
- Detects unpushed commits before destructive operations
- Validates clean working directory when required
- Never auto-force-pushes

### Dry Run Everything

```bash
git oops wrong-branch --dry-run
git oops split --dry-run  
git oops ai commit  # AI commands preview by default
```

## Shell Completion

```bash
# Bash
echo 'eval "$(git-oops completion bash)"' >> ~/.bashrc

# Zsh  
echo 'eval "$(git-oops completion zsh)"' >> ~/.zshrc

# Fish
git-oops completion fish > ~/.config/fish/completions/git-oops.fish
```

## Development

```bash
git clone https://github.com/your-org/git-oops
cd git-oops
npm install
npm run build
npm test
```

### Contributing

1. Fork the repo
2. Create feature branch: `git checkout -b feature/amazing-feature`
3. Commit changes: `git commit -m 'feat: add amazing feature'`
4. Push branch: `git push origin feature/amazing-feature`
5. Open Pull Request

## License

MIT © [git-oops contributors](LICENSE)

## FAQ

**Q: Is it safe to use on important repos?**
A: Yes! Every destructive operation creates safety tags. You can always recover.

**Q: Will AI see my secrets?**  
A: No. Comprehensive redaction removes secrets before any AI API calls.

**Q: Does it work on Windows?**
A: Yes! Tested on Windows, macOS, and Linux.

**Q: Can I use it without AI features?**
A: Absolutely! Core commands work without any AI provider configured.

**Q: What if I don't trust the AI suggestions?**
A: All AI commands preview by default. Use `--apply` only when you're confident.

---

**Made with ❤️ for developers who've been there**
