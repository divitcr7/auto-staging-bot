import fs from 'fs/promises';
import path from 'path';
import os from 'os';
import yaml from 'js-yaml';
import { Config, ConfigSchema } from './types.js';

const CONFIG_FILENAMES = ['.git-oopsrc.json', '.git-oopsrc.yml', '.git-oopsrc.yaml'];

export async function loadConfig(): Promise<Config> {
  // Start with defaults
  let config: Partial<Config> = {};

  // Load global config
  const globalConfig = await loadGlobalConfig();
  if (globalConfig) {
    config = { ...config, ...globalConfig };
  }

  // Load local config (takes precedence)
  const localConfig = await loadLocalConfig();
  if (localConfig) {
    config = { ...config, ...localConfig };
  }

  // Environment variables (highest precedence)
  const envConfig = loadEnvConfig();
  config = { ...config, ...envConfig };

  // Validate and return
  return ConfigSchema.parse(config);
}

async function loadGlobalConfig(): Promise<Partial<Config> | null> {
  const homeDir = os.homedir();
  
  for (const filename of CONFIG_FILENAMES) {
    const configPath = path.join(homeDir, filename);
    
    try {
      const content = await fs.readFile(configPath, 'utf-8');
      return parseConfigFile(content, filename);
    } catch (error) {
      // File doesn't exist or can't be read, continue to next
      continue;
    }
  }
  
  return null;
}

async function loadLocalConfig(): Promise<Partial<Config> | null> {
  // Look for config in current directory and git root
  const searchPaths = [
    process.cwd(),
    await findGitRoot(),
  ].filter(Boolean) as string[];

  for (const searchPath of searchPaths) {
    for (const filename of CONFIG_FILENAMES) {
      const configPath = path.join(searchPath, filename);
      
      try {
        const content = await fs.readFile(configPath, 'utf-8');
        return parseConfigFile(content, filename);
      } catch (error) {
        // File doesn't exist or can't be read, continue to next
        continue;
      }
    }
  }
  
  return null;
}

function parseConfigFile(content: string, filename: string): Partial<Config> {
  if (filename.endsWith('.json')) {
    return JSON.parse(content);
  } else {
    return yaml.load(content) as Partial<Config>;
  }
}

function loadEnvConfig(): Partial<Config> {
  const config: Partial<Config> = {};

  if (process.env.OOPS_PROVIDER) {
    config.provider = process.env.OOPS_PROVIDER as any;
  }
  
  if (process.env.OOPS_MODEL) {
    config.model = process.env.OOPS_MODEL;
  }
  
  if (process.env.OOPS_MAX_KB) {
    config.maxKb = parseInt(process.env.OOPS_MAX_KB, 10);
  }
  
  if (process.env.OOPS_TELEMETRY) {
    config.telemetry = process.env.OOPS_TELEMETRY === 'true';
  }

  return config;
}

async function findGitRoot(): Promise<string | null> {
  let currentDir = process.cwd();
  
  while (currentDir !== path.dirname(currentDir)) {
    try {
      await fs.access(path.join(currentDir, '.git'));
      return currentDir;
    } catch {
      currentDir = path.dirname(currentDir);
    }
  }
  
  return null;
}

// Environment variable helpers for providers
export function getOpenAIApiKey(): string | undefined {
  return process.env.OOPS_OPENAI_API_KEY || process.env.OPENAI_API_KEY;
}

export function getAnthropicApiKey(): string | undefined {
  return process.env.OOPS_ANTHROPIC_API_KEY || process.env.ANTHROPIC_API_KEY;
}

export function getAzureOpenAIConfig(): {
  endpoint?: string;
  apiKey?: string;
} {
  return {
    endpoint: process.env.OOPS_AZURE_OPENAI_ENDPOINT,
    apiKey: process.env.OOPS_AZURE_OPENAI_API_KEY,
  };
}

export function getOllamaConfig(): {
  endpoint?: string;
} {
  return {
    endpoint: process.env.OOPS_OLLAMA_ENDPOINT || 'http://localhost:11434',
  };
}
