import { LLMProvider } from '../../../types.js';
import { Logger } from '../../../utils.js';

interface OllamaResponse {
  response: string;
}

export class OllamaProvider implements LLMProvider {
  public readonly name = 'ollama';

  constructor(
    private endpoint: string,
    private logger: Logger
  ) {}

  async generateCompletion(prompt: string, options: any = {}): Promise<string> {
    const {
      model = 'llama2',
      maxTokens = 1000,
      temperature = 0.1,
    } = options;

    this.logger.verbose(`Ollama request: model=${model}, endpoint=${this.endpoint}`);

    // Ensure endpoint ends with /
    const baseEndpoint = this.endpoint.endsWith('/') ? this.endpoint : `${this.endpoint}/`;
    const url = `${baseEndpoint}api/generate`;

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model,
        prompt,
        stream: false,
        options: {
          num_predict: maxTokens,
          temperature,
        },
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Ollama API error (${response.status}): ${errorText}`);
    }

    const data: OllamaResponse = await response.json();
    
    if (!data.response) {
      throw new Error('Empty response from Ollama API');
    }

    return data.response.trim();
  }

  async isConfigured(): Promise<boolean> {
    try {
      // Test connection to Ollama
      const baseEndpoint = this.endpoint.endsWith('/') ? this.endpoint : `${this.endpoint}/`;
      const response = await fetch(`${baseEndpoint}api/tags`, {
        method: 'GET',
        signal: AbortSignal.timeout(5000), // 5 second timeout
      });
      
      return response.ok;
    } catch (error) {
      this.logger.verbose(`Ollama connection test failed: ${error}`);
      return false;
    }
  }

  // Override to handle async check
  isConfigured(): boolean {
    // For synchronous check, assume it's configured if endpoint is set
    // The actual check happens in async method above
    return Boolean(this.endpoint);
  }
}
