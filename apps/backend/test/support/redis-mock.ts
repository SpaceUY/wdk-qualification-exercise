// Stub for CACHE_REDIS_CLIENT so e2e runs need no Redis instance. `set` always
// reports the treasury lock as acquired and `eval` as released (single-instance
// behavior); `quit` is invoked by RedisCacheModule.onModuleDestroy on app.close().
export function createMockRedisClient() {
  return {
    get: jest.fn().mockResolvedValue(null),
    set: jest.fn().mockResolvedValue('OK'),
    eval: jest.fn().mockResolvedValue(1),
    quit: jest.fn().mockResolvedValue('OK'),
  };
}
