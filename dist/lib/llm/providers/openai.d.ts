import { LLMProvider } from '../../../types.js';
import { Logger } from '../../../utils.js';
export declare class OpenAIProvider implements LLMProvider {
    private apiKey;
    private logger;
    readonly name = "openai";
    constructor(apiKey: string, logger: Logger);
    generateCompletion(prompt: string, options?: any): Promise<string>;
    isConfigured(): boolean;
}
//# sourceMappingURL=openai.d.ts.map