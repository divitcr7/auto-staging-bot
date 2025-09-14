import { z } from 'zod';
// Configuration schema
export const ConfigSchema = z.object({
    provider: z
        .enum(['openai', 'ollama', 'anthropic', 'azure-openai'])
        .optional(),
    model: z.string().optional(),
    maxKb: z.number().default(96),
    telemetry: z.boolean().default(false),
    alwaysIsolate: z.array(z.string()).default([]),
    commitStyle: z.enum(['conventional', 'none']).default('conventional'),
});
// Error types
export class GitOopsError extends Error {
    code;
    cause;
    constructor(message, code = 1, cause) {
        super(message);
        this.code = code;
        this.cause = cause;
        this.name = 'GitOopsError';
    }
}
export class ProviderError extends GitOopsError {
    constructor(message, cause) {
        super(message, 3, cause);
        this.name = 'ProviderError';
    }
}
export class ValidationError extends GitOopsError {
    constructor(message) {
        super(message, 1);
        this.name = 'ValidationError';
    }
}
export class ExternalToolError extends GitOopsError {
    constructor(message, cause) {
        super(message, 2, cause);
        this.name = 'ExternalToolError';
    }
}
//# sourceMappingURL=types.js.map