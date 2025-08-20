import "@testing-library/jest-dom";

// Extend Jest matchers globally
declare global {
  interface Matchers<R> {
    toBeInTheDocument(): R;
    toHaveClass(...classNames: string[]): R;
    toHaveStyle(style: string | Record<string, unknown>): R;
    toBeDisabled(): R;
    toHaveAttribute(attr: string, value?: string): R;
    toHaveValue(value?: string | number): R;
    toHaveFocus(): R;
  }
}

// Mock IntersectionObserver since react-virtuoso uses it
Object.defineProperty(global, "IntersectionObserver", {
  value: class IntersectionObserver {
    readonly root: Element | null = null;
    readonly rootMargin: string = "";
    readonly thresholds: ReadonlyArray<number> = [];

    constructor() {}
    observe() {
      return null;
    }
    disconnect() {
      return null;
    }
    unobserve() {
      return null;
    }
    takeRecords(): IntersectionObserverEntry[] {
      return [];
    }
  },
  writable: true,
});

// Mock ResizeObserver since react-virtuoso uses it
Object.defineProperty(global, "ResizeObserver", {
  value: class ResizeObserver {
    constructor() {}
    observe() {
      return null;
    }
    disconnect() {
      return null;
    }
    unobserve() {
      return null;
    }
  },
  writable: true,
});

// Mock scrollTo
Object.defineProperty(window, "scrollTo", {
  value: jest.fn(),
  writable: true,
});

// Suppress console errors for cleaner test output
const originalError = console.error;
beforeAll(() => {
  console.error = (...args: unknown[]) => {
    if (
      typeof args[0] === "string" &&
      args[0].includes("Warning: ReactDOM.render is deprecated")
    ) {
      return;
    }
    originalError.call(console, ...args);
  };
});

afterAll(() => {
  console.error = originalError;
});

// Mock clsx since it's causing issues in tests
jest.mock("clsx", () => ({
  default: (...classes: (string | undefined | null | false)[]) =>
    classes.filter(Boolean).join(" "),
}));
