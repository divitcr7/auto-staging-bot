import { LLMProvider } from '../../../types.js';
import { Logger } from '../../../utils.js';
export declare class AzureOpenAIProvider implements LLMProvider {
    private apiKey;
    private endpoint;
    private logger;
    readonly name = "azure-openai";
    constructor(apiKey: string, endpoint: string, logger: Logger);
    generateCompletion(prompt: string, options?: any): Promise<string>;
    isConfigured(): boolean;
}
//# sourceMappingURL=azureOpenAI.d.ts.map