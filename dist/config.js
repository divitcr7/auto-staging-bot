import fs from 'fs/promises';
import path from 'path';
import os from 'os';
import yaml from 'js-yaml';
import { ConfigSchema } from './types.js';
const CONFIG_FILENAMES = ['.git-oopsrc.json', '.git-oopsrc.yml', '.git-oopsrc.yaml'];
export async function loadConfig() {
    // Start with defaults
    let config = {};
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
async function loadGlobalConfig() {
    const homeDir = os.homedir();
    for (const filename of CONFIG_FILENAMES) {
        const configPath = path.join(homeDir, filename);
        try {
            const content = await fs.readFile(configPath, 'utf-8');
            return parseConfigFile(content, filename);
        }
        catch (error) {
            // File doesn't exist or can't be read, continue to next
            continue;
        }
    }
    return null;
}
async function loadLocalConfig() {
    // Look for config in current directory and git root
    const searchPaths = [
        process.cwd(),
        await findGitRoot(),
    ].filter(Boolean);
    for (const searchPath of searchPaths) {
        for (const filename of CONFIG_FILENAMES) {
            const configPath = path.join(searchPath, filename);
            try {
                const content = await fs.readFile(configPath, 'utf-8');
                return parseConfigFile(content, filename);
            }
            catch (error) {
                // File doesn't exist or can't be read, continue to next
                continue;
            }
        }
    }
    return null;
}
function parseConfigFile(content, filename) {
    if (filename.endsWith('.json')) {
        return JSON.parse(content);
    }
    else {
        return yaml.load(content);
    }
}
function loadEnvConfig() {
    const config = {};
    if (process.env.OOPS_PROVIDER) {
        config.provider = process.env.OOPS_PROVIDER;
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
async function findGitRoot() {
    let currentDir = process.cwd();
    while (currentDir !== path.dirname(currentDir)) {
        try {
            await fs.access(path.join(currentDir, '.git'));
            return currentDir;
        }
        catch {
            currentDir = path.dirname(currentDir);
        }
    }
    return null;
}
// Environment variable helpers for providers
export function getOpenAIApiKey() {
    return process.env.OOPS_OPENAI_API_KEY || process.env.OPENAI_API_KEY;
}
export function getAnthropicApiKey() {
    return process.env.OOPS_ANTHROPIC_API_KEY || process.env.ANTHROPIC_API_KEY;
}
export function getAzureOpenAIConfig() {
    return {
        endpoint: process.env.OOPS_AZURE_OPENAI_ENDPOINT,
        apiKey: process.env.OOPS_AZURE_OPENAI_API_KEY,
    };
}
export function getOllamaConfig() {
    return {
        endpoint: process.env.OOPS_OLLAMA_ENDPOINT || 'http://localhost:11434',
    };
}
//# sourceMappingURL=config.js.map