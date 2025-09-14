import { LLMProvider } from '../../../types.js';
import { Logger } from '../../../utils.js';
export declare class OllamaProvider implements LLMProvider {
    private endpoint;
    private logger;
    readonly name = "ollama";
    constructor(endpoint: string, logger: Logger);
    generateCompletion(prompt: string, options?: any): Promise<string>;
    testConnection(): Promise<boolean>;
    isConfigured(): boolean;
}
//# sourceMappingURL=ollama.d.ts.map