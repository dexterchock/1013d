/**
 * Detects iOS / iPadOS devices (including iPadOS reporting desktop MacIntel UA).
 */
export const isIosDevice = (): boolean => {
  if (typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent;
  const hasMsStream = Boolean((window as Window & { MSStream?: unknown }).MSStream);
  if (/iPad|iPhone|iPod/.test(ua) && !hasMsStream) {
    return true;
  }
  return navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1;
};

/**
 * Checks native browser support for <a rel="ar"> Quick Look links (iOS Safari).
 */
export const supportsQuickLookAnchor = (): boolean => {
  if (typeof document === 'undefined') return false;
  const anchor = document.createElement('a');
  return Boolean(anchor.relList?.supports?.('ar'));
};

/**
 * Returns true on third-party iOS browsers or in-app WKWebViews that lack native rel="ar" support.
 */
export const isIosThirdPartyBrowser = (): boolean => {
  return isIosDevice() && !supportsQuickLookAnchor();
};

/**
 * Determines whether the current browser/device should expose the AR launcher.
 */
export const detectArSupport = async (): Promise<boolean> => {
  if (supportsQuickLookAnchor() || isIosDevice()) {
    return true;
  }

  if (typeof navigator !== 'undefined' && 'xr' in navigator) {
    const xr = (
      navigator as Navigator & {
        xr?: { isSessionSupported?: (mode: string) => Promise<boolean> };
      }
    ).xr;
    if (xr?.isSessionSupported) {
      try {
        if (await xr.isSessionSupported('immersive-ar')) {
          return true;
        }
      } catch {
        // Ignore XR capability errors and continue fallback checks.
      }
    }
  }

  if (typeof navigator !== 'undefined' && /Android/i.test(navigator.userAgent)) {
    return true;
  }

  return false;
};
