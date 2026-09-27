import "@testing-library/jest-dom/vitest";
import { expect } from "vitest";
import * as axeMatchers from "vitest-axe/matchers";

// jest-axe 相当（vitest-axe）の toHaveNoViolations matcher を登録。
expect.extend(axeMatchers);
