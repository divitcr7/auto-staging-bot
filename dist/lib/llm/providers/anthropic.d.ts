import { LLMProvider } from '../../../types.js';
import { Logger } from '../../../utils.js';
export declare class AnthropicProvider implements LLMProvider {
    private apiKey;
    private logger;
    readonly name = "anthropic";
    constructor(apiKey: string, logger: Logger);
    generateCompletion(prompt: string, options?: any): Promise<string>;
    isConfigured(): boolean;
}
//# sourceMappingURL=anthropic.d.ts.map