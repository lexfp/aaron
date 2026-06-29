# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: game-state.spec.js >> Game state after starting a match >> zombie wave starts at 1
- Location: tests/e2e/game-state.spec.js:45:5

# Error details

```
Test timeout of 60000ms exceeded.
```

```
Error: page.waitForSelector: Target crashed 
Call log:
  - waiting for locator('#homepage') to be visible

```

```
Tearing down "context" exceeded the test timeout of 60000ms.
```