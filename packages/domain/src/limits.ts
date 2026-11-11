// Product limits shared by the API (validation), the database (check constraints) and the app (forms).
// Dependency-free so clients can import it without pulling in date libraries.
export const MIN_WEEKS = 1;
export const MAX_WEEKS = 16;
export const MIN_CAPACITY = 3;
export const MAX_CAPACITY = 20;
