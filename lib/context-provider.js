import { detectEpicContext, formatEpicDisplay, getEpicUrl } from './epic-detector.js';

/**
 * Provides cached context for OpenCode sessions
 */
export class ContextProvider {
  constructor() {
    this.cache = new Map();
  }
  
  /**
   * Gets epic context for a directory (with caching)
   * @param {string} cwd - Current working directory
   * @returns {Object|null} Epic context
   */
  getContext(cwd) {
    if (this.cache.has(cwd)) {
      return this.cache.get(cwd);
    }
    
    const context = detectEpicContext(cwd);
    this.cache.set(cwd, context);
    return context;
  }
  
  /**
   * Invalidates cache for a directory
   * @param {string} cwd - Current working directory
   */
  invalidateCache(cwd) {
    this.cache.delete(cwd);
  }
  
  /**
   * Clears all cached contexts
   */
  clearCache() {
    this.cache.clear();
  }
  
  /**
   * Gets formatted display string for header bar
   * @param {string} cwd - Current working directory
   * @returns {string|null} Formatted epic display
   */
  getDisplayString(cwd) {
    const context = this.getContext(cwd);
    return formatEpicDisplay(context);
  }
  
  /**
   * Gets GitHub URL for epic
   * @param {string} cwd - Current working directory
   * @returns {string|null} GitHub issue URL
   */
  getEpicUrl(cwd) {
    const context = this.getContext(cwd);
    return getEpicUrl(context);
  }
}
