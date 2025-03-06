/**
 * Performance Utilities for Super Chat application
 * Contains optimizations for event handling, rendering, and memory management
 */

(function() {
  // Wait for DOM to be fully loaded
  document.addEventListener('DOMContentLoaded', function() {
    console.log('Performance utilities initialized');
    optimizeScrollEvents();
    optimizeResizeEvents();
    optimizeImageLoading();
    optimizeDOMOperations();
  });

  /**
   * Debounce function to limit the rate at which a function can fire
   * @param {Function} func - The function to debounce
   * @param {number} wait - The debounce delay in milliseconds
   * @param {boolean} immediate - Whether to trigger the function immediately
   * @returns {Function} - Debounced function
   */
  function debounce(func, wait, immediate) {
    let timeout;
    return function() {
      const context = this, args = arguments;
      const later = function() {
        timeout = null;
        if (!immediate) func.apply(context, args);
      };
      const callNow = immediate && !timeout;
      clearTimeout(timeout);
      timeout = setTimeout(later, wait);
      if (callNow) func.apply(context, args);
    };
  }

  /**
   * Throttle function to limit the rate at which a function can fire
   * @param {Function} func - The function to throttle
   * @param {number} limit - The throttle limit in milliseconds
   * @returns {Function} - Throttled function
   */
  function throttle(func, limit) {
    let inThrottle;
    return function() {
      const args = arguments;
      const context = this;
      if (!inThrottle) {
        func.apply(context, args);
        inThrottle = true;
        setTimeout(() => inThrottle = false, limit);
      }
    };
  }

  /**
   * Optimize scroll event handlers across the application
   * Replaces direct scroll handlers with debounced/throttled versions
   */
  function optimizeScrollEvents() {
    // Get all elements that might have scroll handlers
    const scrollableElements = document.querySelectorAll('.chat-messages, .files-panel, [class*="scroll"]');
    
    // For each scrollable element, replace handlers with optimized versions
    scrollableElements.forEach(element => {
      // Store original scroll handler if it exists
      const originalScrollHandler = element.onscroll;
      
      if (originalScrollHandler) {
        // Replace with throttled version for smooth UI updates
        element.onscroll = throttle(originalScrollHandler, 100);
      }
      
      // Apply passive scroll listener for better performance
      element.addEventListener('scroll', function() {}, { passive: true });
    });
    
    // Optimize window scroll as well
    const originalWindowScroll = window.onscroll;
    if (originalWindowScroll) {
      window.onscroll = throttle(originalWindowScroll, 100);
    }
  }

  /**
   * Optimize resize event handlers
   */
  function optimizeResizeEvents() {
    const originalResize = window.onresize;
    
    if (originalResize) {
      // Debounce resize handler - resize events typically need less frequent updates
      window.onresize = debounce(originalResize, 150);
    }
    
    // Create a general resize handler that can be used by multiple components
    window.optimizedResize = {
      callbacks: [],
      pending: false,
      
      // Add a callback to the resize handler
      add: function(callback) {
        if (typeof callback === 'function') {
          this.callbacks.push(debounce(callback, 150));
        }
      },
      
      // Trigger all callbacks
      trigger: function() {
        if (this.pending) return;
        this.pending = true;
        
        window.requestAnimationFrame(() => {
          this.callbacks.forEach(callback => callback());
          this.pending = false;
        });
      }
    };
    
    // Add event listener for resize using the optimized handler
    window.addEventListener('resize', () => {
      window.optimizedResize.trigger();
    });
  }

  /**
   * Optimize image loading with lazy loading
   */
  function optimizeImageLoading() {
    // Check for native lazy loading support
    const supportsLazyLoading = 'loading' in HTMLImageElement.prototype;
    
    if (supportsLazyLoading) {
      // Use native lazy loading for images
      document.querySelectorAll('img:not([loading])').forEach(img => {
        img.setAttribute('loading', 'lazy');
      });
    } else {
      // Fallback for browsers that don't support native lazy loading
      const lazyImages = document.querySelectorAll('img:not([src=""]):not([src^="data:"])');
      
      if (lazyImages.length === 0) return;
      
      // Create IntersectionObserver for lazy loading
      const imageObserver = new IntersectionObserver((entries, observer) => {
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            const img = entry.target;
            const src = img.getAttribute('data-src');
            
            if (src) {
              img.src = src;
              img.removeAttribute('data-src');
            }
            
            observer.unobserve(img);
          }
        });
      });
      
      // Observe each image
      lazyImages.forEach(img => {
        const src = img.src;
        img.setAttribute('data-src', src);
        img.src = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1 1"%3E%3C/svg%3E';
        imageObserver.observe(img);
      });
    }
  }

  /**
   * Optimize DOM operations by batching updates
   */
  function optimizeDOMOperations() {
    // Create a utility for batching DOM updates
    window.batchDOMUpdates = (function() {
      const updates = [];
      let scheduled = false;
      
      // Schedule a batch update
      function scheduleUpdate() {
        if (scheduled) return;
        
        scheduled = true;
        window.requestAnimationFrame(() => {
          // Process all updates in one frame
          const callbacks = updates.slice();
          updates.length = 0;
          scheduled = false;
          
          callbacks.forEach(callback => callback());
        });
      }
      
      // Add an update to the batch
      return function(callback) {
        if (typeof callback === 'function') {
          updates.push(callback);
          scheduleUpdate();
        }
      };
    })();
    
    // Apply CSS containment to scrollable elements for better performance
    document.querySelectorAll('.chat-messages, .files-panel').forEach(element => {
      element.style.contain = 'content';
    });
  }

  // Make utilities available globally
  window.performanceUtils = {
    debounce: debounce,
    throttle: throttle
  };
})();