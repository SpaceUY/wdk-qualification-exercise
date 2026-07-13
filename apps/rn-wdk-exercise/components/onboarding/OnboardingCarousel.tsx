import { useRef, useState } from 'react';
import { StyleSheet, TouchableOpacity, View } from 'react-native';
import PagerView from 'react-native-pager-view';
import { spacing } from '@/theme/tokens';
import { AppText, Button, PaginationDots } from '@/components/ui';
import { OnboardingSlide } from './OnboardingSlide';
import type { OnboardingSlideData } from './slides';

export type OnboardingCarouselProps = {
  slides: OnboardingSlideData[];
  onDone: () => void;
};

// Native paging (UIPageViewController/ViewPager2) keeps the swipe on the UI thread;
// React state only tracks the settled page for the dots and the footer button.
export function OnboardingCarousel({ slides, onDone }: OnboardingCarouselProps) {
  const pagerRef = useRef<PagerView>(null);
  const [page, setPage] = useState(0);
  const isLastPage = page === slides.length - 1;

  return (
    <View style={styles.container}>
      <View style={styles.skipRow}>
        {!isLastPage && (
          <TouchableOpacity testID="onboarding-skip" hitSlop={8} onPress={onDone}>
            <AppText variant="caption" color="textMuted">Skip</AppText>
          </TouchableOpacity>
        )}
      </View>

      <PagerView
        ref={pagerRef}
        style={styles.pager}
        initialPage={0}
        onPageSelected={(e) => setPage(e.nativeEvent.position)}
      >
        {slides.map((slide) => (
          <View key={slide.key} collapsable={false}>
            <OnboardingSlide slide={slide} />
          </View>
        ))}
      </PagerView>

      <View style={styles.footer}>
        <PaginationDots count={slides.length} activeIndex={page} />
        <Button
          testID="onboarding-next"
          title={isLastPage ? 'Get Started' : 'Next'}
          onPress={isLastPage ? onDone : () => pagerRef.current?.setPage(page + 1)}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  skipRow: {
    alignItems: 'flex-end',
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.md,
    // Reserved even while hidden so the pager doesn't jump on the last page.
    minHeight: 32,
  },
  pager: { flex: 1 },
  footer: { padding: spacing.xl, gap: spacing.xl },
});
