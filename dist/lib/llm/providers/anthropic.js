export class AnthropicProvider {
    apiKey;
    logger;
    name = 'anthropic';
    constructor(apiKey, logger) {
        this.apiKey = apiKey;
        this.logger = logger;
    }
    async generateCompletion(prompt, options = {}) {
        const { model = 'claude-3-haiku-20240307', maxTokens = 1000, temperature = 0.1, } = options;
        this.logger.verbose(`Anthropic request: model=${model}, maxTokens=${maxTokens}`);
        const response = await fetch('https://api.anthropic.com/v1/messages', {
            method: 'POST',
            headers: {
                'x-api-key': this.apiKey,
                'Content-Type': 'application/json',
                'anthropic-version': '2023-06-01',
            },
            body: JSON.stringify({
                model,
                max_tokens: maxTokens,
                temperature,
                messages: [
                    {
                        role: 'user',
                        content: prompt,
                    },
                ],
            }),
        });
        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Anthropic API error (${response.status}): ${errorText}`);
        }
        const data = await response.json();
        if (!data.content || data.content.length === 0) {
            throw new Error('No content returned from Anthropic API');
        }
        const text = data.content[0].text;
        if (!text) {
            throw new Error('Empty text returned from Anthropic API');
        }
        return text.trim();
    }
    isConfigured() {
        return Boolean(this.apiKey);
    }
}
//# sourceMappingURL=anthropic.js.map