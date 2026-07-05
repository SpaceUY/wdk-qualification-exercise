import type { ReactNode } from 'react';
import { Text } from 'react-native';

// Real Stack/Redirect/useRouter depend on being mounted inside an actual Expo Router
// navigation tree, which isolated screen/layout tests don't have. This stub renders
// just enough structure (and records enough calls) for tests to assert against.

export const router = {
  push: jest.fn(),
  replace: jest.fn(),
  back: jest.fn(),
  navigate: jest.fn(),
  setParams: jest.fn(),
};

export const useRouter = jest.fn(() => router);

export const useLocalSearchParams = jest.fn(() => ({}) as Record<string, string | undefined>);

export const Redirect = jest.fn(({ href }: { href: string }) => (
  <Text testID="mock-redirect">{href}</Text>
));

function StackBase({ children }: { children?: ReactNode }) {
  return <>{children}</>;
}

function StackScreenBase() {
  return null;
}

export const Stack = Object.assign(jest.fn(StackBase), {
  Screen: jest.fn(StackScreenBase),
});
