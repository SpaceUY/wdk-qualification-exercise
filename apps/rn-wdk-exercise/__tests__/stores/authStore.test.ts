import { useAuthStore } from '../../stores/authStore';

describe('authStore', () => {
  beforeEach(() => {
    useAuthStore.setState({ userId: null });
    jest.clearAllMocks();
  });

  it('has null userId as initial state', () => {
    expect(useAuthStore.getState().userId).toBeNull();
  });

  describe('setUserId', () => {
    it('sets userId to the provided string', () => {
      useAuthStore.getState().setUserId('alice@example.com');
      expect(useAuthStore.getState().userId).toBe('alice@example.com');
    });

    it('overwrites an existing userId', () => {
      useAuthStore.getState().setUserId('first@example.com');
      useAuthStore.getState().setUserId('second@example.com');
      expect(useAuthStore.getState().userId).toBe('second@example.com');
    });

    it('accepts an empty string', () => {
      useAuthStore.getState().setUserId('');
      expect(useAuthStore.getState().userId).toBe('');
    });

    it('accepts a UUID-formatted string', () => {
      const uuid = 'f47ac10b-58cc-4372-a567-0e02b2c3d479';
      useAuthStore.getState().setUserId(uuid);
      expect(useAuthStore.getState().userId).toBe(uuid);
    });
  });

  describe('clear', () => {
    it('sets userId back to null', () => {
      useAuthStore.getState().setUserId('alice@example.com');
      useAuthStore.getState().clear();
      expect(useAuthStore.getState().userId).toBeNull();
    });

    it('is idempotent when userId is already null', () => {
      useAuthStore.getState().clear();
      expect(useAuthStore.getState().userId).toBeNull();
    });
  });

  it('state is isolated between tests (beforeEach reset works)', () => {
    expect(useAuthStore.getState().userId).toBeNull();
  });

  describe('accessToken', () => {
    it('starts as null', () => {
      const store = useAuthStore.getState();
      expect(store.accessToken).toBeNull();
    });

    it('setAccessToken persists the token', () => {
      useAuthStore.getState().setAccessToken('id-token-abc');
      expect(useAuthStore.getState().accessToken).toBe('id-token-abc');
    });

    it('clear resets accessToken to null', () => {
      useAuthStore.getState().setAccessToken('id-token-abc');
      useAuthStore.getState().clear();
      expect(useAuthStore.getState().accessToken).toBeNull();
    });
  });

  describe('persisted storage', () => {
    it('clearStorage removes the persisted entry without throwing', () => {
      expect(() => useAuthStore.persist.clearStorage()).not.toThrow();
    });
  });
});
