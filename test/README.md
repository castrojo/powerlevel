# Integration Tests

Comprehensive end-to-end integration tests for the OpenCode Superpower system.

## Overview

The integration test script (`integration-test.sh`) validates the entire wiki sync and agent context discovery system from onboarding through task completion tracking.

## Running the Tests

```bash
./test/integration-test.sh
```

The script will:
- Check for required dependencies (node, git, gh)
- Run all integration tests
- Clean up test resources automatically
- Display a summary of results

## Test Coverage

### 1. Dependency Checks
- Verifies Node.js (v18+), git, and gh CLI are installed
- Checks Node.js version compatibility

### 2. Onboarding Flow
- Creates test repository
- Runs onboarding script
- Verifies superpowers remote added correctly
- Validates configuration file

### 3. Wiki Synchronization (Dry Run)
- Tests wiki sync script execution
- Validates configuration handling
- Skips actual GitHub API calls

### 4. Epic Creation
- Tests plan file parsing
- Validates epic creation logic
- Skips actual GitHub issue creation (to avoid test pollution)

### 5. Task Completion Detection
- Creates test git commits with completion keywords
- Tests detection of `closes #N`, `fixes #N`, `resolves #N`, `completes #N`
- Validates commit parsing logic

### 6. Cache Management
- Tests cache creation and loading
- Validates epic and sub-issue operations
- Tests cache persistence

### 7. Configuration Loading
- Tests config file parsing
- Validates configuration schema
- Tests error handling

### 8. Repository Detection
- Tests SSH URL parsing (`git@github.com:owner/repo.git`)
- Tests HTTPS URL parsing (`https://github.com/owner/repo.git`)
- Validates owner/repo extraction

## Test Results

The script displays colored output:
- 🟢 **Green**: Tests passed
- 🔴 **Red**: Tests failed  
- 🟡 **Yellow**: Tests skipped (requires authentication/network)
- 🔵 **Blue**: Informational messages

## Dependencies

Required tools:
- **Node.js** v18 or higher
- **git** (any recent version)
- **gh** (GitHub CLI) for authentication checks

Optional for full testing:
- GitHub CLI authentication (`gh auth login`)
- Network connectivity to fetch from superpowers remote

## Test Safety

The integration tests are designed to be safe:

- ✅ Uses temporary directories (cleaned up automatically)
- ✅ Never modifies actual repositories
- ✅ Skips operations requiring GitHub API calls (unless authenticated)
- ✅ Cleans up resources even on test failure
- ✅ No real GitHub issues created during tests

## Debugging

If a test fails, you can:

1. **Check detailed output**: Tests print informational messages as they run

2. **Disable cleanup**: Edit the script and set `CLEANUP_ON_EXIT=false` to inspect test directories

3. **Run specific components manually**:
   ```bash
   node bin/onboard-project.js --force
   node bin/sync-wiki.js --dry-run
   ```

4. **Check test directories**: Temporary directories are named `/tmp/opencode-test-{PID}-{testname}-{random}`

## Integration with CI/CD

The test script is designed to work in CI/CD pipelines:

```bash
# Exit code 0 on success, 1 on failure
./test/integration-test.sh
echo "Exit code: $?"
```

For CI environments without GitHub CLI authentication:
- Tests requiring authentication will be skipped
- Core functionality tests still run

## Adding New Tests

To add a new integration test:

1. Create a new test function:
   ```bash
   function test_my_new_feature() {
     test_start "My new feature"
     
     # Test setup
     local test_dir=$(mktemp -d -t "${TEST_PREFIX}-mytest-XXXXXX")
     CLEANUP_DIRS+=("$test_dir")
     
     # Test logic
     # ...
     
     # Assertions
     if [ condition ]; then
       test_pass "Feature works correctly"
     else
       test_fail "Feature failed"
     fi
   }
   ```

2. Call it from `main()`:
   ```bash
   function main() {
     # ... existing tests ...
     test_my_new_feature
   }
   ```

## Manual Verification

For features that can't be fully automated, the tests include manual verification steps:

- **Onboarding**: Verify docs/SUPERPOWERS.md content
- **Wiki sync**: Verify wiki pages match source files
- **Epic creation**: Verify GitHub issue structure and labels
- **Task updates**: Verify journey entries in epic body

## Known Limitations

1. **Wiki sync**: Requires network access and authentication to test fully
2. **Epic creation**: Skips actual GitHub API calls to avoid test pollution
3. **Project board**: Not tested (requires existing project board)
4. **Real remote fetch**: Superpowers remote fetch may fail without SSH keys

## Continuous Improvement

As the system evolves, update tests to:
- Cover new features (journey updates, project board integration)
- Add regression tests for bugs
- Improve test isolation and speed
- Add more granular assertions

## Support

If tests fail unexpectedly:
1. Check that all dependencies are up to date
2. Verify GitHub CLI authentication if running auth-required tests
3. Check for conflicting processes or file locks
4. Review the test output for specific error messages
5. Open an issue with the full test output

---

**Last updated**: 2026-02-10
**Test coverage**: Core functionality (onboarding, wiki sync, epic creation, task detection)
**Maintenance**: Run tests before each commit to catch regressions early
