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