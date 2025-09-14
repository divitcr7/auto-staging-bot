import { LLMProvider } from '../../../types.js';
import { Logger } from '../../../utils.js';

interface AzureOpenAIResponse {
  choices: Array<{
    message: {
      content: string;
    };
  }>;
}

export class AzureOpenAIProvider implements LLMProvider {
  public readonly name = 'azure-openai';

  constructor(
    private apiKey: string,
    private endpoint: string,
    private logger: Logger
  ) {}

  async generateCompletion(prompt: string, options: any = {}): Promise<string> {
    const {
      model = 'gpt-35-turbo',
      maxTokens = 1000,
      temperature = 0.1,
      apiVersion = '2023-12-01-preview',
    } = options;

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

    const data: AzureOpenAIResponse = await response.json();
    
    if (!data.choices || data.choices.length === 0) {
      throw new Error('No choices returned from Azure OpenAI API');
    }

    const content = data.choices[0].message.content;
    if (!content) {
      throw new Error('Empty content returned from Azure OpenAI API');
    }

    return content.trim();
  }

  isConfigured(): boolean {
    return Boolean(this.apiKey && this.endpoint);
  }
}
