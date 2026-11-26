// src/lib/server/requestDeadline.js

import "server-only";

export class RequestDeadlineError extends Error {
    constructor() {
        super("Request deadline exceeded");

        this.name = "RequestDeadlineError";
    }
}

export function createRequestDeadline(timeoutMs) {
    if (
        !Number.isFinite(timeoutMs) ||
        timeoutMs <= 0
    ) {
        throw new Error("Invalid request timeout");
    }

    const deadline = performance.now() + timeoutMs;

    function remaining() {
        return Math.max(
            0,
            Math.floor(deadline - performance.now())
        );
    }

    function expired() {
        return remaining() <= 0;
    }

    function getTimeout(maximum = Infinity) {
        const timeout = Math.min(
            remaining(),
            maximum
        );

        if (timeout <= 0) {
            throw new RequestDeadlineError();
        }

        return timeout;
    }

    return {
        remaining,
        expired,
        getTimeout,
    };
}