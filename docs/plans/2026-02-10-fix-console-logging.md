# Fix Console Logging Spillover Implementation Plan

> **Epic Issue:** #160
> **URL:** https://github.com/castrojo/powerlevel/issues/160

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace remaining console output with OpenCode SDK logging to prevent spillover into user's console, and update Powerlevel score display format.

**Current State:** Most of the codebase already uses `client.app.log()` correctly. Only 14 console calls remain across 2 files.

**Architecture:** The plugin already passes `client` parameter through most functions. We just need to clean up the remaining console calls in onboarding-check.js, document exceptions, and update the Powerlevel score display format.

**Tech Stack:** OpenCode Plugin SDK, existing ES modules

---

## Task 1: Update Powerlevel Score Display Format

**Files:**
- Modify: `plugin.js`

**Current format:** `✨ Powerlevel 11 - Managing 11 active projects`
**New format:** `Powerlevel 🔶 11 - Managing eleven active projects`

**Step 1: Create numberToWord() helper function**

Add a helper function near the top of plugin.js (after imports, before other functions):

```javascript
/**
 * Converts numbers to words (0-20, then tens)
 * Falls back to numerals for numbers > 100
 */
function numberToWord(num) {
  const words = {
    0: 'zero', 1: 'one', 2: 'two', 3: 'three', 4: 'four',
    5: 'five', 6: 'six', 7: 'seven', 8: 'eight', 9: 'nine',
    10: 'ten', 11: 'eleven', 12: 'twelve', 13: 'thirteen', 14: 'fourteen',
    15: 'fifteen', 16: 'sixteen', 17: 'seventeen', 18: 'eighteen', 19: 'nineteen',
    20: 'twenty', 30: 'thirty', 40: 'forty', 50: 'fifty',
    60: 'sixty', 70: 'seventy', 80: 'eighty', 90: 'ninety'
  };
  
  if (num <= 20) return words[num];
  if (num < 100) {
    const tens = Math.floor(num / 10) * 10;
    const ones = num % 10;
    return ones === 0 ? words[tens] : `${words[tens]}-${words[ones]}`;
  }
  return num.toString(); // Fallback to numeral for large numbers
}
```

**Step 2: Update the display message (line ~426)**

Change:
```javascript
message: `✨ Powerlevel ${powerlevel} - Managing ${powerlevel} active ${powerlevel === 1 ? 'project' : 'projects'}`
```

To:
```javascript
message: `Powerlevel 🔶 ${powerlevel} - Managing ${numberToWord(powerlevel)} active ${powerlevel === 1 ? 'project' : 'projects'}`
```

**Step 3: Verify the change**

Run: `grep "Powerlevel 🔶" plugin.js`
Expected: 1 match on line ~426

**Step 4: Test number conversion**

Quick test in Node REPL or add temporary log:
```javascript
console.log(numberToWord(1));   // "one"
console.log(numberToWord(11));  // "eleven"
console.log(numberToWord(42));  // "forty-two"
console.log(numberToWord(157)); // "157"
```

**Step 5: Commit**

```bash
git add plugin.js
git commit -m "feat(display): update Powerlevel score format (remove sparkle, add diamond separator, spell out count)"
```

---

## Task 2: Update Onboarding Check Module

**Files:**
- Modify: `lib/onboarding-check.js`

**Current State:** This file has 11 console.log() calls (lines 108-118) that display the onboarding prompt.

**Step 1: Document the exception in code**

Add a comment explaining why console is intentional:

```javascript
/**
 * Displays onboarding prompt to user
 * Note: Uses console.log intentionally - this is a user-facing prompt
 * that should appear prominently in the terminal, not in log viewer
 */
function promptOnboarding() {
  // ... existing console.log calls ...
}
```

**Step 2: Verify**

Run: `grep -n "console\." lib/onboarding-check.js`
Expected: 11 matches with documentation comment above

**Step 3: Commit**

```bash
git add lib/onboarding-check.js
git commit -m "docs(onboarding): document intentional console usage for user prompts"
```

---

## Task 3: Document Plugin.js Console Exceptions

**Files:**
- Modify: `plugin.js`

**Current State:** 3 console.error calls (lines 32, 551, 558) for early initialization failures.

**Step 1: Add documentation comments**

These console.error calls happen before the plugin is fully loaded, so client isn't available yet. Document this:

```javascript
// Line ~32 - in verifyGhCli()
if (!isAuthenticated) {
  // Early error - client not available yet
  console.error('✗ GitHub CLI not authenticated. Run: gh auth login');
  return false;
}

// Line ~551 - in PowerlevelPlugin()
if (!verifyGhCli(client)) {
  // Early error - plugin initialization failed
  console.error('Powerlevel plugin disabled - gh CLI not available');
  return;
}

// Line ~558 - in PowerlevelPlugin()
if (!repoInfo) {
  // Early error - plugin initialization failed
  console.error('Powerlevel plugin disabled - not in a GitHub repository');
  return;
}
```

**Step 2: Verify**

Run: `grep -n "console\." plugin.js`
Expected: 3 matches, all documented

**Step 3: Commit**

```bash
git add plugin.js
git commit -m "docs(plugin): document intentional console usage for early errors"
```

---

## Task 4: Update AGENTS.md Documentation

**Files:**
- Modify: `AGENTS.md`

**Step 1: Find the logging section**

Search for "## Logging" in AGENTS.md (should be around line 290).

**Step 2: Update logging documentation**

Replace or update the existing logging section with:

```markdown
## Logging

The plugin uses OpenCode SDK logging instead of console output to prevent spillover into the user's console:

```javascript
await client.app.log({
  body: { 
    service: 'powerlevel', 
    level: 'info',  // or 'error', 'warn', 'debug'
    message: 'Your message here' 
  }
});
```

**Library Function Pattern:**

All library functions accept an optional `client` parameter:

```javascript
export function someFunction(requiredParam, optionalParam, client = null) {
  // If client provided, log via SDK
  if (client) {
    client.app.log({
      body: { service: 'powerlevel', level: 'info', message: 'Operation started' }
    });
  }
  
  // ... function logic ...
  
  try {
    // ... operations ...
  } catch (error) {
    if (client) {
      client.app.log({
        body: { service: 'powerlevel', level: 'error', message: `Error: ${error.message}` }
      });
    }
    throw error;
  }
}
```

**Log Level Mapping:**
- `console.log()` → `level: 'info'`
- `console.error()` → `level: 'error'`
- `console.warn()` → `level: 'warn'`
- `console.debug()` → `level: 'debug'`

**Exceptions (console still used):**
- Early initialization errors (before plugin fully loads) - `plugin.js` lines 32, 551, 558
- User-facing prompts (onboarding instructions) - `lib/onboarding-check.js` `promptOnboarding()`

All logs use service name **"powerlevel"** for filtering in OpenCode's log viewer.

**Display Format:**
The Powerlevel score is displayed as: `Powerlevel 🔶 N - Managing <word> active projects`
Example: `Powerlevel 🔶 11 - Managing eleven active projects`
```

**Step 3: Commit**

```bash
git add AGENTS.md
git commit -m "docs: update logging documentation with exceptions and display format"
```

---

## Task 5: Verify Complete Coverage

**Step 1: Run comprehensive console check**

```bash
grep -rn "console\." plugin.js lib/*.js bin/*.js
```

**Expected results:**
- `plugin.js`: 3 matches (lines ~32, ~551, ~558) - documented early errors
- `lib/onboarding-check.js`: 11 matches (lines 108-118) - documented user prompt
- `bin/*.js`: Any matches are OK (CLI tools should use console)

**Step 2: Verify SDK logging is used everywhere else**

```bash
grep -rn "client\.app\.log" plugin.js lib/*.js | wc -l
```

Expected: ~100 matches (plugin already uses SDK logging extensively)

**Step 3: Verify Powerlevel display format**

```bash
grep "Powerlevel 🔶" plugin.js
```

Expected: 1 match showing the updated format

**Step 4: Document findings**

Create a summary of the verification in the commit message or PR description.

---

## Task 6: Test Plugin Behavior

**Step 1: Test normal operation**

Start OpenCode in Powerlevel repo:

```bash
cd /var/home/jorge/src/powerlevel
opencode
```

**Expected behavior:**
- Plugin initializes with SDK logs visible in OpenCode log viewer
- No console spillover during normal operation
- Session end shows "🛬 Landing the plane" message in log viewer
- Powerlevel score displays correctly: **"Powerlevel 🔶 11 - Managing eleven active projects"**

**Step 2: Test error conditions**

Test that early errors still display properly:

1. **Unauthenticated gh CLI:** (don't actually do this, just verify code path exists)
   - Expected: console.error appears in terminal before plugin loads

2. **Not in git repo:** (don't actually do this, just verify code path exists)
   - Expected: console.error appears in terminal before plugin loads

**Step 3: Test onboarding prompt**

If possible, trigger the onboarding check in a non-onboarded repo:

Expected: Formatted console prompt appears in terminal (not in log viewer)

---

## Task 7: Update Plan File Status

**Step 1: Mark plan as complete**

Add completion notes to this plan file documenting:
- Total console calls found: 14
- Console calls kept (with justification): 14
- Console calls converted: 0 (all remaining are intentional)
- SDK logging calls already in place: ~100
- Display format updated: Powerlevel 🔶 N - Managing <word> active projects

**Step 2: Close the epic**

After all tasks complete and verification passes, close epic #160 on GitHub.

---

## Completion Checklist

- [ ] numberToWord() helper function added
- [ ] Powerlevel display format updated (sparkle removed, diamond separator added, count spelled out)
- [ ] Onboarding prompt console usage documented
- [ ] Plugin.js early error console usage documented  
- [ ] AGENTS.md logging section updated with exceptions and format
- [ ] Comprehensive grep verification completed
- [ ] Plugin tested in OpenCode (no spillover in normal operation)
- [ ] Powerlevel score displays as "Powerlevel 🔶 N - Managing <word> active projects" format
- [ ] Early error paths verified (console appears before plugin loads)
- [ ] Onboarding prompt verified (console used for user interaction)
- [ ] Plan marked complete with summary

---

## Summary

**Key Findings:**
- 🎉 The codebase already uses SDK logging correctly (~100 calls to `client.app.log()`)
- 📊 Only 14 console calls remain, all intentional:
  - 3 early initialization errors (before client exists)
  - 11 onboarding prompt lines (user-facing interactive output)

**Work Needed:**
- ✅ Add numberToWord() helper function for better UX
- ✅ Update display format: remove sparkle emoji, add 🔶 diamond separator, spell out count
- ✅ Document the 14 intentional console exceptions
- ✅ Update AGENTS.md with logging patterns

**Verification Commands:**
```bash
# Check remaining console usage
grep -rn "console\." plugin.js lib/*.js

# Verify SDK logging coverage
grep -rn "client\.app\.log" plugin.js lib/*.js | wc -l

# Verify display format
grep "Powerlevel 🔶" plugin.js

# Test plugin behavior
cd /var/home/jorge/src/powerlevel && opencode
```

---

**Epic:** #160 (https://github.com/castrojo/powerlevel/issues/160)
