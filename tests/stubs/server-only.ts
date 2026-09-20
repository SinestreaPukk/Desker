// `server-only` exists purely to fail a build that imports server code into a
// client bundle. Under Vitest there is no bundle boundary, so it is a no-op.
export {};
