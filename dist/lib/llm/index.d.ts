import { LLMProvider, Config } from '../../types.js';
import { Logger } from '../../utils.js';
export interface LLMOptions {
    provider?: string;
    model?: string;
    maxTokens?: number;
    temperature?: number;
}
export declare class LLMManager {
    private config;
    private providers;
    private logger;
    constructor(config: Config, logger: Logger);
    private initializeProviders;
    getProvider(providerName?: string): LLMProvider;
    generateCompletion(prompt: string, options?: LLMOptions): Promise<string>;
    getAvailableProviders(): string[];
    isAnyProviderConfigured(): boolean;
    private getDefaultModel;
    private getConfigurationHelp;
    generateWithSystemPrompt(systemPrompt: string, userPrompt: string, options?: LLMOptions): Promise<string>;
    generateStructuredResponse<T>(prompt: string, schema: string, options?: LLMOptions): Promise<T>;
    getCommitPromptTemplate(): string;
    getSplitPromptTemplate(): string;
    getReviewPromptTemplate(): string;
    getRiskPromptTemplate(): string;
    getConflictResolutionTemplate(): string;
}
//# sourceMappingURL=index.d.ts.map