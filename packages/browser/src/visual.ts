import type { BrowserDriver } from './driver.js';
import { BrowserError } from './errors.js';
import type { BrowserImage } from './types.js';
export async function captureScreenshot(driver: BrowserDriver): Promise<BrowserImage> {
  if (!driver.capabilities.screenshots || !driver.screenshot) throw new BrowserError('UNSUPPORTED_OPERATION', 'Driver does not support screenshots', false);
  return driver.screenshot();
}
