"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SyncInProgressError = void 0;
class SyncInProgressError extends Error {
    constructor(customerId) {
        super(`A synchronization for customer ${customerId} is already running.`);
        this.name = 'SyncInProgressError';
    }
}
exports.SyncInProgressError = SyncInProgressError;
//# sourceMappingURL=errors.js.map