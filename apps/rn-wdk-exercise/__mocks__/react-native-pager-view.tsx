import { forwardRef, useImperativeHandle } from 'react';
import { View, type ViewProps } from 'react-native';

type MockPagerProps = ViewProps & {
  initialPage?: number;
  onPageSelected?: (e: { nativeEvent: { position: number } }) => void;
};

// The real component is a native pager view. This mock renders every page flat and
// wires ref.setPage() straight to onPageSelected, so tests can advance pages the same
// way the production code does (pagerRef.current?.setPage(n)).
const PagerView = forwardRef<{ setPage: (page: number) => void }, MockPagerProps>(
  function MockPagerView({ children, onPageSelected, initialPage: _initialPage, ...props }, ref) {
    useImperativeHandle(ref, () => ({
      setPage: (page: number) => onPageSelected?.({ nativeEvent: { position: page } }),
    }));
    return (
      <View testID="mock-pager-view" {...props}>
        {children}
      </View>
    );
  },
);

export default PagerView;
