/** Cheap WebGL capability probe. Caller must guard for the browser first. */
export function supportsWebGL(): boolean {
  try {
    const canvas = document.createElement('canvas');
    return (
      typeof WebGLRenderingContext !== 'undefined' &&
      !!(canvas.getContext('webgl') || canvas.getContext('experimental-webgl'))
    );
  } catch {
    return false;
  }
}
