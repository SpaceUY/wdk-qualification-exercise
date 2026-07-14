// Shared geometry for the tab screens' floating filter overlay. Single owner for
// values that must stay in sync between the dashboard and history lists.
//
// Height of the floating filter row + its fade tail — the gradient overlay is this
// tall so it can fade out below the chips.
export const FILTER_OVERLAY_HEIGHT = 72;
// List/skeleton content starts inside the gradient's fade tail so the first row sits
// close under the filter row while the fade still softens the overlap.
export const LIST_CONTENT_TOP_PADDING = 64;
