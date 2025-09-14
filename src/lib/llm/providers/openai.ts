import { LLMProvider } from '../../../types.js';
import { Logger } from '../../../utils.js';

interface OpenAIResponse {
  choices: Array<{
    message: {
      content: string;
    };
  }>;
}

export class OpenAIProvider implements LLMProvider {
  public readonly name = 'openai';

  constructor(
    private apiKey: string,
    private logger: Logger
  ) {}

  async generateCompletion(prompt: string, options: any = {}): Promise<string> {
    const {
      model = 'gpt-3.5-turbo',
      maxTokens = 1000,
      temperature = 0.1,
    } = options;

    this.logger.verbose(`OpenAI request: model=${model}, maxTokens=${maxTokens}`);

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model,
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
      throw new Error(`OpenAI API error (${response.status}): ${errorText}`);
    }

    const data: OpenAIResponse = await response.json();
    
    if (!data.choices || data.choices.length === 0) {
      throw new Error('No choices returned from OpenAI API');
    }

    const content = data.choices[0].message.content;
    if (!content) {
      throw new Error('Empty content returned from OpenAI API');
    }

    return content.trim();
  }

  isConfigured(): boolean {
    return Boolean(this.apiKey);
  }
}
