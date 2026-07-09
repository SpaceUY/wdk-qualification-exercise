// expo-screen-capture ships native module bindings Jest can't load.
export const usePreventScreenCapture = jest.fn();
export const preventScreenCaptureAsync = jest.fn().mockResolvedValue(undefined);
export const allowScreenCaptureAsync = jest.fn().mockResolvedValue(undefined);
