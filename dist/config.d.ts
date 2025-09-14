import { Config } from './types.js';
export declare function loadConfig(): Promise<Config>;
export declare function getOpenAIApiKey(): string | undefined;
export declare function getAnthropicApiKey(): string | undefined;
export declare function getAzureOpenAIConfig(): {
    endpoint?: string;
    apiKey?: string;
};
export declare function getOllamaConfig(): {
    endpoint?: string;
};
//# sourceMappingURL=config.d.ts.map