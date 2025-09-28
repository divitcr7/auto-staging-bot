// Theme management
class ThemeManager {
  constructor() {
    this.theme = this.getInitialTheme();
    this.themeToggle = document.querySelector(".theme-toggle");
    this.init();
  }

  getInitialTheme() {
    // Check localStorage first
    const storedTheme = localStorage.getItem("theme");
    if (storedTheme) {
      return storedTheme;
    }

    // Fall back to system preference
    const systemPrefersDark = window.matchMedia(
      "(prefers-color-scheme: dark)"
    ).matches;
    return systemPrefersDark ? "dark" : "light";
  }

  init() {
    this.setTheme(this.theme);
    this.themeToggle?.addEventListener("click", () => this.toggleTheme());

    // Listen for system theme changes
    window
      .matchMedia("(prefers-color-scheme: dark)")
      .addEventListener("change", (e) => {
        // Only auto-switch if user hasn't manually set a preference
        if (!localStorage.getItem("theme")) {
          this.setTheme(e.matches ? "dark" : "light");
        }
      });
  }

  setTheme(theme) {
    this.theme = theme;
    document.documentElement.setAttribute("data-theme", theme);
    localStorage.setItem("theme", theme);

    if (this.themeToggle) {
      const icon = this.themeToggle.querySelector(".theme-icon");
      icon.textContent = theme === "light" ? "🌙" : "☀️";

      // Update tooltip
      this.themeToggle.setAttribute(
        "title",
        theme === "light" ? "Switch to dark theme" : "Switch to light theme"
      );
    }
  }

  toggleTheme() {
    this.setTheme(this.theme === "dark" ? "light" : "dark");
  }
}

// Copy to clipboard functionality
class ClipboardManager {
  constructor() {
    this.notification = document.getElementById("copy-notification");
    this.init();
  }

  init() {
    document.addEventListener("click", (e) => {
      if (e.target.closest(".copy-btn")) {
        this.handleCopy(e.target.closest(".copy-btn"));
      }
    });
  }

  async handleCopy(button) {
    const text = button.getAttribute("data-copy");

    try {
      await navigator.clipboard.writeText(text);
      this.showNotification("Copied to clipboard!");
    } catch (err) {
      // Fallback for older browsers
      this.fallbackCopy(text);
      this.showNotification("Copied to clipboard!");
    }
  }

  fallbackCopy(text) {
    const textArea = document.createElement("textarea");
    textArea.value = text;
    textArea.style.position = "fixed";
    textArea.style.left = "-999999px";
    textArea.style.top = "-999999px";
    document.body.appendChild(textArea);
    textArea.focus();
    textArea.select();
    document.execCommand("copy");
    textArea.remove();
  }

  showNotification(message) {
    if (this.notification) {
      const messageSpan = this.notification.querySelector("span");
      messageSpan.textContent = message;

      this.notification.classList.add("show");

      setTimeout(() => {
        this.notification.classList.remove("show");
      }, 2000);
    }
  }
}

// Command filter functionality
class CommandFilter {
  constructor() {
    this.filterInput = document.getElementById("command-filter");
    this.commandCards = document.querySelectorAll(".command-card");
    this.init();
  }

  init() {
    if (this.filterInput) {
      this.filterInput.addEventListener("input", (e) => {
        this.filterCommands(e.target.value.toLowerCase());
      });
    }
  }

  filterCommands(searchTerm) {
    this.commandCards.forEach((card) => {
      const command = card.getAttribute("data-command") || "";
      const commandText =
        card.querySelector(".command-name")?.textContent.toLowerCase() || "";
      const descriptionText =
        card.querySelector(".command-description")?.textContent.toLowerCase() ||
        "";
      const exampleText =
        card.querySelector(".command-code")?.textContent.toLowerCase() || "";

      const matches =
        command.includes(searchTerm) ||
        commandText.includes(searchTerm) ||
        descriptionText.includes(searchTerm) ||
        exampleText.includes(searchTerm);

      card.style.display = matches ? "block" : "none";

      if (matches) {
        card.style.animation = "fadeInUp 0.3s ease forwards";
      }
    });
  }
}

// Smooth scroll for navigation links
class NavigationManager {
  constructor() {
    this.navHeader = document.querySelector(".nav-header");
    this.init();
  }

  init() {
    // Smooth scroll for anchor links
    document.addEventListener("click", (e) => {
      const link = e.target.closest('a[href^="#"]');
      if (link) {
        e.preventDefault();
        this.smoothScrollTo(link.getAttribute("href"));
      }
    });

    // Navbar scroll effect
    window.addEventListener("scroll", () => this.handleScroll());
  }

  smoothScrollTo(target) {
    const element = document.querySelector(target);
    if (element) {
      const navHeight = this.navHeader?.offsetHeight || 0;
      const elementPosition = element.offsetTop - navHeight - 20;

      window.scrollTo({
        top: elementPosition,
        behavior: "smooth",
      });
    }
  }

  handleScroll() {
    if (this.navHeader) {
      const scrolled = window.scrollY > 50;
      const theme =
        document.documentElement.getAttribute("data-theme") || "dark";

      if (theme === "light") {
        this.navHeader.style.background = scrolled
          ? "rgba(255, 255, 255, 0.98)"
          : "rgba(255, 255, 255, 0.9)";
      } else {
        this.navHeader.style.background = scrolled
          ? "rgba(11, 15, 20, 0.95)"
          : "rgba(11, 15, 20, 0.9)";
      }
    }
  }
}

// Terminal animation effects
class TerminalAnimations {
  constructor() {
    this.init();
  }

  init() {
    this.animateTyping();
    this.observeElements();
  }

  animateTyping() {
    const typingElements = document.querySelectorAll(
      ".typing, .typing-delayed"
    );

    typingElements.forEach((element, index) => {
      const text = element.textContent;
      const isDelayed = element.classList.contains("typing-delayed");
      const delay = isDelayed ? 4000 : 1000;

      element.textContent = "";
      element.style.width = "0";

      setTimeout(() => {
        element.textContent = text;
        element.style.width = "auto";
      }, delay);
    });
  }

  observeElements() {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.style.animationPlayState = "running";
          }
        });
      },
      {
        threshold: 0.1,
      }
    );

    // Observe animated elements
    const animatedElements = document.querySelectorAll(
      ".typing, .typing-delayed"
    );
    animatedElements.forEach((el) => observer.observe(el));
  }
}

// Keyboard shortcuts
class KeyboardShortcuts {
  constructor() {
    this.init();
  }

  init() {
    document.addEventListener("keydown", (e) => {
      // Only trigger if not typing in an input
      if (e.target.tagName === "INPUT" || e.target.tagName === "TEXTAREA") {
        return;
      }

      switch (e.key.toLowerCase()) {
        case "i":
          e.preventDefault();
          this.navigateTo("#install");
          break;
        case "/":
          e.preventDefault();
          this.focusFilter();
          break;
      }
    });
  }

  navigateTo(target) {
    const element = document.querySelector(target);
    if (element) {
      element.scrollIntoView({ behavior: "smooth" });
    }
  }

  focusFilter() {
    const filterInput = document.getElementById("command-filter");
    if (filterInput) {
      filterInput.focus();
    }
  }
}

// Performance monitoring
class PerformanceMonitor {
  constructor() {
    this.init();
  }

  init() {
    if ("performance" in window) {
      window.addEventListener("load", () => {
        // Monitor page load performance
        setTimeout(() => {
          const perfData = performance.getEntriesByType("navigation")[0];
          const loadTime = perfData.loadEventEnd - perfData.loadEventStart;

          if (loadTime > 2000) {
            console.warn(`Page loaded in ${loadTime}ms - consider optimizing`);
          }
        }, 100);
      });
    }
  }
}

// Error boundary for graceful degradation
class ErrorBoundary {
  constructor() {
    this.init();
  }

  init() {
    window.addEventListener("error", (e) => {
      console.error("JavaScript error:", e.error);
      // Could implement user-facing error notification here
    });

    window.addEventListener("unhandledrejection", (e) => {
      console.error("Unhandled promise rejection:", e.reason);
    });
  }
}

// Accessibility enhancements
class AccessibilityEnhancer {
  constructor() {
    this.init();
  }

  init() {
    this.enhanceFocusVisibility();
    this.announcePageChanges();
    this.handleReducedMotion();
  }

  enhanceFocusVisibility() {
    // Add focus indicators for keyboard navigation
    document.addEventListener("keydown", (e) => {
      if (e.key === "Tab") {
        document.body.classList.add("keyboard-navigation");
      }
    });

    document.addEventListener("mousedown", () => {
      document.body.classList.remove("keyboard-navigation");
    });
  }

  announcePageChanges() {
    // Announce dynamic content changes to screen readers
    const announcer = document.createElement("div");
    announcer.setAttribute("aria-live", "polite");
    announcer.setAttribute("aria-atomic", "true");
    announcer.className = "sr-only";
    document.body.appendChild(announcer);

    // Store reference for potential use
    this.announcer = announcer;
  }

  handleReducedMotion() {
    const mediaQuery = window.matchMedia("(prefers-reduced-motion: reduce)");

    if (mediaQuery.matches) {
      // Disable animations for users who prefer reduced motion
      const style = document.createElement("style");
      style.textContent = `
        *, *::before, *::after {
          animation-duration: 0.01ms !important;
          animation-iteration-count: 1 !important;
          transition-duration: 0.01ms !important;
        }
      `;
      document.head.appendChild(style);
    }
  }

  announce(message) {
    if (this.announcer) {
      this.announcer.textContent = message;
    }
  }
}

// Initialize everything when DOM is ready
class App {
  constructor() {
    this.components = [];
    this.init();
  }

  init() {
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", () =>
        this.initializeComponents()
      );
    } else {
      this.initializeComponents();
    }
  }

  initializeComponents() {
    try {
      // Initialize all components
      this.components = [
        new ErrorBoundary(),
        new ThemeManager(),
        new ClipboardManager(),
        new CommandFilter(),
        new NavigationManager(),
        new TerminalAnimations(),
        new KeyboardShortcuts(),
        new PerformanceMonitor(),
        new AccessibilityEnhancer(),
      ];

      console.log("git-oops website initialized successfully");
    } catch (error) {
      console.error("Failed to initialize website components:", error);
    }
  }
}

// Start the application
new App();

// Export for potential testing or extension
if (typeof module !== "undefined" && module.exports) {
  module.exports = {
    ThemeManager,
    ClipboardManager,
    CommandFilter,
    NavigationManager,
    TerminalAnimations,
    KeyboardShortcuts,
    PerformanceMonitor,
    ErrorBoundary,
    AccessibilityEnhancer,
    App,
  };
}
