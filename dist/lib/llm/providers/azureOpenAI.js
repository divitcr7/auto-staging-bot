export class AzureOpenAIProvider {
    apiKey;
    endpoint;
    logger;
    name = 'azure-openai';
    constructor(apiKey, endpoint, logger) {
        this.apiKey = apiKey;
        this.endpoint = endpoint;
        this.logger = logger;
    }
    async generateCompletion(prompt, options = {}) {
        const { model = 'gpt-35-turbo', maxTokens = 1000, temperature = 0.1, apiVersion = '2023-12-01-preview', } = options;
        this.logger.verbose(`Azure OpenAI request: model=${model}, maxTokens=${maxTokens}`);
        // Ensure endpoint ends with /
        const baseEndpoint = this.endpoint.endsWith('/') ? this.endpoint : `${this.endpoint}/`;
        const url = `${baseEndpoint}openai/deployments/${model}/chat/completions?api-version=${apiVersion}`;
        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'api-key': this.apiKey,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                messages: [
                    {
                        role: 'user',
                        content: prompt,
                    },
                ],
                max_tokens: maxTokens,
                temperature,
            }),
        });
        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Azure OpenAI API error (${response.status}): ${errorText}`);
        }
        const data = await response.json();
        if (!data.choices || data.choices.length === 0) {
            throw new Error('No choices returned from Azure OpenAI API');
        }
        const content = data.choices[0].message.content;
        if (!content) {
            throw new Error('Empty content returned from Azure OpenAI API');
        }
        return content.trim();
    }
    isConfigured() {
        return Boolean(this.apiKey && this.endpoint);
    }
}
//# sourceMappingURL=azureOpenAI.js.map