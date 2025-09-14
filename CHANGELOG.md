# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- Initial release of git-oops
- Core commands: wrong-branch, split, yank, pocket, revert-merge
- AI-assisted commands: commit, split, review, risk, revert-plan, conflicts, migrate-sanity  
- Support for OpenAI, Anthropic, Azure OpenAI, and Ollama providers
- Comprehensive security redaction for AI commands
- Automatic safety tag creation for all destructive operations
- Cross-platform support (Windows, macOS, Linux)
- Shell completion for bash, zsh, and fish
- Configuration via files and environment variables

### Security
- Automatic filtering of sensitive files (.env, .key, .pem, etc.)
- Pattern-based redaction of secrets (API keys, passwords, tokens)
- Content size limits for AI submissions
- No telemetry collection by default

## [1.0.0] - 2024-03-15

### Added
- Initial public release
- Full TypeScript implementation with ESM modules
- Comprehensive test suite with CI/CD pipeline
- MIT license
- Complete documentation and examples

### Changed
- N/A (initial release)

### Deprecated
- N/A (initial release)

### Removed
- N/A (initial release)

### Fixed
- N/A (initial release)

### Security
- Implemented comprehensive secret redaction system
- Added safety tag backup system
- Protected branch detection and warnings
