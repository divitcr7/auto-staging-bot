import { ProviderError } from '../../types.js';
import { getOpenAIApiKey, getAnthropicApiKey, getAzureOpenAIConfig, getOllamaConfig } from '../../config.js';
// Import providers
import { OpenAIProvider } from './providers/openai.js';
import { AnthropicProvider } from './providers/anthropic.js';
import { AzureOpenAIProvider } from './providers/azureOpenAI.js';
import { OllamaProvider } from './providers/ollama.js';
export class LLMManager {
    config;
    providers = new Map();
    logger;
    constructor(config, logger) {
        this.config = config;
        this.logger = logger;
        this.initializeProviders();
    }
    initializeProviders() {
        // OpenAI
        const openaiKey = getOpenAIApiKey();
        if (openaiKey) {
            this.providers.set('openai', new OpenAIProvider(openaiKey, this.logger));
        }
        // Anthropic
        const anthropicKey = getAnthropicApiKey();
        if (anthropicKey) {
            this.providers.set('anthropic', new AnthropicProvider(anthropicKey, this.logger));
        }
        // Azure OpenAI
        const azureConfig = getAzureOpenAIConfig();
        if (azureConfig.apiKey && azureConfig.endpoint) {
            this.providers.set('azure-openai', new AzureOpenAIProvider(azureConfig.apiKey, azureConfig.endpoint, this.logger));
        }
        // Ollama
        const ollamaConfig = getOllamaConfig();
        this.providers.set('ollama', new OllamaProvider(ollamaConfig.endpoint || 'http://localhost:11434', this.logger));
    }
    getProvider(providerName) {
        const targetProvider = providerName || this.config.provider;
        if (!targetProvider) {
            throw new ProviderError('No AI provider configured. Set OOPS_PROVIDER environment variable or configure in .git-oopsrc');
        }
        const provider = this.providers.get(targetProvider);
        if (!provider) {
            const availableProviders = Array.from(this.providers.keys());
            throw new ProviderError(`Provider '${targetProvider}' not available. ` +
                `Available providers: ${availableProviders.join(', ')}`);
        }
        if (!provider.isConfigured()) {
            throw new ProviderError(`Provider '${targetProvider}' is not properly configured. ` +
                this.getConfigurationHelp(targetProvider));
        }
        return provider;
    }
    async generateCompletion(prompt, options = {}) {
        const provider = this.getProvider(options.provider);
        const model = options.model || this.getDefaultModel(options.provider || this.config.provider);
        this.logger.verbose(`Using provider: ${provider.name}, model: ${model}`);
        try {
            return await provider.generateCompletion(prompt, {
                model,
                maxTokens: options.maxTokens,
                temperature: options.temperature,
            });
        }
        catch (error) {
            throw new ProviderError(`AI completion failed: ${error.message}`, error);
        }
    }
    getAvailableProviders() {
        return Array.from(this.providers.keys()).filter(name => this.providers.get(name).isConfigured());
    }
    isAnyProviderConfigured() {
        return this.getAvailableProviders().length > 0;
    }
    getDefaultModel(providerName) {
        const defaults = {
            'openai': 'gpt-3.5-turbo',
            'anthropic': 'claude-3-haiku-20240307',
            'azure-openai': 'gpt-35-turbo',
            'ollama': 'llama2',
        };
        return this.config.model || defaults[providerName] || 'gpt-3.5-turbo';
    }
    getConfigurationHelp(providerName) {
        const help = {
            'openai': 'Set OOPS_OPENAI_API_KEY or OPENAI_API_KEY environment variable',
            'anthropic': 'Set OOPS_ANTHROPIC_API_KEY or ANTHROPIC_API_KEY environment variable',
            'azure-openai': 'Set OOPS_AZURE_OPENAI_ENDPOINT and OOPS_AZURE_OPENAI_API_KEY environment variables',
            'ollama': 'Ensure Ollama is running on localhost:11434 or set OOPS_OLLAMA_ENDPOINT',
        };
        return help[providerName] || 'Check provider documentation for configuration';
    }
    // Utility methods for AI commands
    async generateWithSystemPrompt(systemPrompt, userPrompt, options = {}) {
        const fullPrompt = `${systemPrompt}\n\nUser: ${userPrompt}\n\nAssistant:`;
        return this.generateCompletion(fullPrompt, options);
    }
    async generateStructuredResponse(prompt, schema, options = {}) {
        const structuredPrompt = `${prompt}\n\nReturn your response in the following format:\n${schema}`;
        const response = await this.generateCompletion(structuredPrompt, options);
        try {
            return JSON.parse(response);
        }
        catch (error) {
            // Try to extract JSON from response
            const jsonMatch = response.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
                try {
                    return JSON.parse(jsonMatch[0]);
                }
                catch {
                    // Fall through to error
                }
            }
            throw new ProviderError(`AI response is not valid JSON: ${response.substring(0, 200)}...`);
        }
    }
    // Prompt templates for consistent AI interactions
    getCommitPromptTemplate() {
        return `You are a release engineer. Output ONLY:
Title: <Conventional Commit subject line>
Body:
<2-6 concise lines or bullets>

Rules:
- Use feat|fix|chore|docs|refactor|test prefixes
- Include 'Closes #123' if issue patterns appear in diff
- No extra text or explanations
- Keep title under 72 characters
- Body should explain what and why, not how`;
    }
    getSplitPromptTemplate() {
        return `You split staged changes into logical commits. Targets: feature code, tests, docs, migrations, config.

Rules:
- Always isolate migrations and *.sql files
- Group tests together
- Group documentation together
- Separate configuration changes
- Return STRICT JSON only:

[{"title":"<commit title>","paths":["<path1>","<path2>"]}]

No comments, no extra keys, no explanations.`;
    }
    getReviewPromptTemplate() {
        return `You are a senior engineer reviewing code changes. Generate a PR description with:

## What
Brief description of changes

## Why  
Business context and motivation

## Risk Areas
- Potential issues or concerns
- Areas requiring extra attention

## Manual Testing
- Key scenarios to test
- Edge cases to verify

## Release Notes
- User-facing changes (if any)
- Breaking changes (if any)

Be concise but thorough. Focus on what reviewers need to know.`;
    }
    getRiskPromptTemplate() {
        return `Assess the risk level of these code changes. Return JSON:

{
  "level": "Low|Medium|High",
  "reasons": ["reason 1", "reason 2"],
  "blastRadius": "description of impact scope",
  "guardrails": ["mitigation 1", "mitigation 2"]
}

Risk factors:
- Database migrations or schema changes
- Authentication/authorization changes
- Payment or billing logic
- External API integrations
- Performance-critical code
- Breaking changes`;
    }
    getConflictResolutionTemplate() {
        return `You are a merge-conflict assistant. For each conflicted file (content limited to conflict markers only), produce the minimal unified diff patch to resolve, and 1-2 line reasoning.

Return sections:
PATCH:
<unified diff>

NOTES:
- <point 1>
- <point 2>

Focus on safe, conservative resolutions. When in doubt, preserve both changes with clear separation.`;
    }
}
//# sourceMappingURL=index.js.map