import { useWalletOnboardingStore } from '../../stores/walletOnboardingStore';

const INITIAL_STATE = {
  walletOnboardingCompleted: false,
  shouldShowOnboarding: false,
  shouldPromptMnemonic: false,
};

describe('walletOnboardingStore', () => {
  beforeEach(() => {
    useWalletOnboardingStore.setState({ ...INITIAL_STATE });
    jest.clearAllMocks();
  });

  describe('initial state', () => {
    it('walletOnboardingCompleted is false', () => {
      expect(useWalletOnboardingStore.getState().walletOnboardingCompleted).toBe(false);
    });

    it('shouldShowOnboarding is false', () => {
      expect(useWalletOnboardingStore.getState().shouldShowOnboarding).toBe(false);
    });

    it('shouldPromptMnemonic is false', () => {
      expect(useWalletOnboardingStore.getState().shouldPromptMnemonic).toBe(false);
    });
  });

  describe('setWalletOnboardingCompleted', () => {
    it('sets to true', () => {
      useWalletOnboardingStore.getState().setWalletOnboardingCompleted(true);
      expect(useWalletOnboardingStore.getState().walletOnboardingCompleted).toBe(true);
    });

    it('sets back to false', () => {
      useWalletOnboardingStore.getState().setWalletOnboardingCompleted(true);
      useWalletOnboardingStore.getState().setWalletOnboardingCompleted(false);
      expect(useWalletOnboardingStore.getState().walletOnboardingCompleted).toBe(false);
    });

    it('does not affect other fields', () => {
      useWalletOnboardingStore.getState().setWalletOnboardingCompleted(true);
      expect(useWalletOnboardingStore.getState().shouldShowOnboarding).toBe(false);
      expect(useWalletOnboardingStore.getState().shouldPromptMnemonic).toBe(false);
    });
  });

  describe('setShouldShowOnboarding', () => {
    it('sets to true', () => {
      useWalletOnboardingStore.getState().setShouldShowOnboarding(true);
      expect(useWalletOnboardingStore.getState().shouldShowOnboarding).toBe(true);
    });

    it('sets back to false', () => {
      useWalletOnboardingStore.getState().setShouldShowOnboarding(true);
      useWalletOnboardingStore.getState().setShouldShowOnboarding(false);
      expect(useWalletOnboardingStore.getState().shouldShowOnboarding).toBe(false);
    });

    it('does not affect other fields', () => {
      useWalletOnboardingStore.getState().setShouldShowOnboarding(true);
      expect(useWalletOnboardingStore.getState().walletOnboardingCompleted).toBe(false);
      expect(useWalletOnboardingStore.getState().shouldPromptMnemonic).toBe(false);
    });
  });

  describe('setShouldPromptMnemonic', () => {
    it('sets to true', () => {
      useWalletOnboardingStore.getState().setShouldPromptMnemonic(true);
      expect(useWalletOnboardingStore.getState().shouldPromptMnemonic).toBe(true);
    });

    it('sets back to false', () => {
      useWalletOnboardingStore.getState().setShouldPromptMnemonic(true);
      useWalletOnboardingStore.getState().setShouldPromptMnemonic(false);
      expect(useWalletOnboardingStore.getState().shouldPromptMnemonic).toBe(false);
    });

    it('does not affect other fields', () => {
      useWalletOnboardingStore.getState().setShouldPromptMnemonic(true);
      expect(useWalletOnboardingStore.getState().walletOnboardingCompleted).toBe(false);
      expect(useWalletOnboardingStore.getState().shouldShowOnboarding).toBe(false);
    });
  });

  describe('resetStore', () => {
    it('resets all boolean fields to false', () => {
      useWalletOnboardingStore.setState({
        walletOnboardingCompleted: true,
        shouldShowOnboarding: true,
        shouldPromptMnemonic: true,
      });
      useWalletOnboardingStore.getState().resetStore();
      const state = useWalletOnboardingStore.getState();
      expect(state.walletOnboardingCompleted).toBe(false);
      expect(state.shouldShowOnboarding).toBe(false);
      expect(state.shouldPromptMnemonic).toBe(false);
    });

    it('is idempotent when already in initial state', () => {
      useWalletOnboardingStore.getState().resetStore();
      const state = useWalletOnboardingStore.getState();
      expect(state.walletOnboardingCompleted).toBe(false);
      expect(state.shouldShowOnboarding).toBe(false);
      expect(state.shouldPromptMnemonic).toBe(false);
    });

    it('setters remain callable after reset', () => {
      useWalletOnboardingStore.setState({ walletOnboardingCompleted: true });
      useWalletOnboardingStore.getState().resetStore();
      expect(() =>
        useWalletOnboardingStore.getState().setWalletOnboardingCompleted(true),
      ).not.toThrow();
    });
  });

  describe('persisted storage', () => {
    it('clearStorage removes the persisted entry without throwing', () => {
      expect(() => useWalletOnboardingStore.persist.clearStorage()).not.toThrow();
    });
  });
});
