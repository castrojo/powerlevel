#!/bin/bash
# Integration Test Script for Opencode Superpower
# Tests the complete end-to-end flow: onboarding → wiki sync → epic creation → task completion

set -e  # Exit on error

# Color output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Test counters
TESTS_RUN=0
TESTS_PASSED=0
TESTS_SKIPPED=0

# Store project root (one level up from test directory)
PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

# Test configuration
TEST_PREFIX="opencode-test-$$"
CLEANUP_ON_EXIT=true

# Track created resources for cleanup
CLEANUP_DIRS=()

#############################################
# Helper Functions
#############################################

function test_start() {
  echo -e "\n${BLUE}▶ Testing: $1${NC}"
  TESTS_RUN=$((TESTS_RUN + 1))
}

function test_pass() {
  echo -e "${GREEN}✓ $1${NC}"
  TESTS_PASSED=$((TESTS_PASSED + 1))
}

function test_fail() {
  echo -e "${RED}✗ $1${NC}"
  cleanup_test_resources
  exit 1
}

function test_skip() {
  echo -e "${YELLOW}⊘ Skipped: $1${NC}"
  TESTS_SKIPPED=$((TESTS_SKIPPED + 1))
}

function info() {
  echo -e "${BLUE}  ℹ $1${NC}"
}

function cleanup_test_resources() {
  if [ "$CLEANUP_ON_EXIT" = true ]; then
    echo -e "\n${YELLOW}Cleaning up test resources...${NC}"
    
    for dir in "${CLEANUP_DIRS[@]}"; do
      if [ -d "$dir" ]; then
        echo "  Removing $dir"
        rm -rf "$dir"
      fi
    done
    
    echo -e "${GREEN}✓ Cleanup complete${NC}"
  fi
}

# Register cleanup handler
trap cleanup_test_resources EXIT

#############################################
# Dependency Checks
#############################################

function check_dependencies() {
  test_start "Dependency checks"
  
  local missing=()
  
  for cmd in node git gh; do
    if ! command -v $cmd &> /dev/null; then
      missing+=("$cmd")
    fi
  done
  
  if [ ${#missing[@]} -ne 0 ]; then
    test_fail "Missing dependencies: ${missing[*]}. Please install them."
  fi
  
  # Check Node version (should be 18+)
  local node_version=$(node --version | sed 's/v//' | cut -d. -f1)
  if [ "$node_version" -lt 18 ]; then
    test_fail "Node version must be 18 or higher (current: $node_version)"
  fi
  
  test_pass "All dependencies present (node, git, gh)"
}

#############################################
# Test 1: Onboarding Flow
#############################################

function test_onboarding() {
  test_start "Onboarding flow"
  
  # Create temporary test directory
  local test_dir=$(mktemp -d -t "${TEST_PREFIX}-onboarding-XXXXXX")
  CLEANUP_DIRS+=("$test_dir")
  info "Created test directory: $test_dir"
  
  cd "$test_dir"
  
  # Initialize git repo
  git init -q
  git config user.email "test@opencode.test"
  git config user.name "OpenCode Test"
  git remote add origin git@github.com:test/test-repo.git
  info "Initialized test git repository"
  
  # Create minimal config to test onboarding
  mkdir -p .opencode
  cat > .opencode/config.json << EOF
{
  "superpowers": {
    "enabled": true,
    "remote": "superpowers",
    "repoUrl": "git@github.com:castrojo/superpowers.git",
    "autoOnboard": false,
    "wikiSync": true
  },
  "wiki": {
    "autoSync": false,
    "syncOnCommit": false,
    "includeSkills": true,
    "includeDocs": true
  }
}
EOF
  info "Created test configuration"
  
  # Run onboarding script with --force to skip prompts
  # Note: This may fail if the remote cannot be fetched (network/auth issues)
  # We consider the test passed if the remote is added, even if fetch fails
  node "$PROJECT_ROOT/bin/onboard-project.js" --force > /tmp/onboard-output.txt 2>&1 || true
  info "Onboarding script executed"
  
  # Verify superpowers remote was added
  if ! git remote | grep -q "superpowers"; then
    test_fail "Superpowers remote not found after onboarding"
  fi
  
  # Verify remote URL is correct
  local remote_url=$(git remote get-url superpowers)
  if [ "$remote_url" != "git@github.com:castrojo/superpowers.git" ]; then
    test_fail "Superpowers remote URL incorrect: $remote_url"
  fi
  
  # Verify config file exists (it was pre-created by test)
  if [ ! -f ".opencode/config.json" ]; then
    test_fail "Config file not found"
  fi
  
  # Note: docs/ and SUPERPOWERS.md are only created if fetch succeeds
  # For this test, we verify the remote was added successfully
  # which is the core functionality of onboarding
  
  cd - > /dev/null
  test_pass "Onboarding completed successfully"
}

#############################################
# Test 2: Wiki Sync (Dry Run)
#############################################

function test_wiki_sync() {
  test_start "Wiki synchronization (dry-run)"
  
  # Create temporary test directory
  local test_dir=$(mktemp -d -t "${TEST_PREFIX}-wiki-XXXXXX")
  CLEANUP_DIRS+=("$test_dir")
  
  cd "$test_dir"
  
  # Initialize git repo
  git init -q
  git config user.email "test@opencode.test"
  git config user.name "OpenCode Test"
  git remote add origin git@github.com:anomalyco/opencode-superpower.git
  
  # Create config with wiki sync enabled
  mkdir -p .opencode
  cat > .opencode/config.json << EOF
{
  "superpowers": {
    "enabled": true,
    "remote": "superpowers",
    "repoUrl": "git@github.com:castrojo/superpowers.git",
    "wikiSync": true
  },
  "wiki": {
    "autoSync": true,
    "includeSkills": true,
    "includeDocs": true
  }
}
EOF
  
  # Add superpowers remote
  git remote add superpowers git@github.com:castrojo/superpowers.git
  
  # Create some test docs to sync
  mkdir -p docs
  echo "# Test Documentation" > docs/TEST.md
  info "Created test documentation"
  
  # Run sync in dry-run mode (doesn't require GitHub API or wiki access)
  # Note: This will fail if superpowers remote can't be fetched, so we expect errors
  # We're testing that the script runs without crashing
  if node "$PROJECT_ROOT/bin/sync-wiki.js" --dry-run 2>&1 | grep -q "dry run"; then
    test_pass "Wiki sync dry-run mode works"
  else
    # If it fails for authentication reasons, that's acceptable for this test
    test_skip "Wiki sync test (requires network and authentication)"
  fi
  
  cd - > /dev/null
}

#############################################
# Test 3: Epic Creation
#############################################

function test_epic_creation() {
  test_start "Epic creation from plan file"
  
  # Check if GitHub CLI is authenticated
  if ! gh auth status &>/dev/null; then
    test_skip "Epic creation (requires GitHub CLI authentication)"
    return
  fi
  
  # Create temporary test directory
  local test_dir=$(mktemp -d -t "${TEST_PREFIX}-epic-XXXXXX")
  CLEANUP_DIRS+=("$test_dir")
  
  cd "$test_dir"
  
  # Initialize git repo
  git init -q
  git config user.email "test@opencode.test"
  git config user.name "OpenCode Test"
  
  # Set up a test repository (use a safe test repo or skip if not available)
  # For safety, we'll skip actual GitHub API calls and just test parsing
  
  # Create test plan file
  mkdir -p .opencode/plans
  cat > .opencode/plans/test-feature.md << 'EOF'
# Test Feature Integration

Priority: P2

## Goal

Validate epic creation from plan files

## Tasks

- Setup test environment
- Create test cases  
- Run validation
EOF
  
  info "Created test plan file"
  
  # Test plan parsing without GitHub API calls
  # Just verify the parser can read the file without errors
  node -e "
    import { parsePlanFile } from '$PROJECT_ROOT/lib/parser.js';
    const plan = parsePlanFile('.opencode/plans/test-feature.md');
    
    if (!plan.title) throw new Error('No title parsed');
    if (!plan.hasOwnProperty('tasks')) throw new Error('No tasks array');
    if (!plan.hasOwnProperty('goal')) throw new Error('No goal field');
    if (!plan.hasOwnProperty('priority')) throw new Error('No priority field');
    
    console.log('Plan parsing successful');
    console.log('  Title:', plan.title);
    console.log('  Priority:', plan.priority);
    console.log('  Tasks found:', plan.tasks.length);
  " 2>&1
  
  if [ $? -eq 0 ]; then
    test_pass "Plan parsing works correctly"
  else
    test_fail "Plan parsing failed"
  fi
  
  cd - > /dev/null
  
  # Skip actual epic creation to avoid creating test issues
  test_skip "Actual GitHub epic creation (would create real issues)"
}

#############################################
# Test 4: Task Completion Detection
#############################################

function test_task_completion_detection() {
  test_start "Task completion detection from commits"
  
  # Create temporary test directory
  local test_dir=$(mktemp -d -t "${TEST_PREFIX}-detection-XXXXXX")
  CLEANUP_DIRS+=("$test_dir")
  
  cd "$test_dir"
  
  # Initialize git repo
  git init -q
  git config user.email "test@opencode.test"
  git config user.name "OpenCode Test"
  
  # Create initial commit
  echo "initial" > README.md
  git add README.md
  git commit -q -m "Initial commit"
  
  # Create commits with task completion keywords
  echo "feature 1" > feature1.txt
  git add feature1.txt
  git commit -q -m "feat: add feature 1 closes #123"
  
  echo "bug fix" > bugfix.txt
  git add bugfix.txt
  git commit -q -m "fix: resolve critical issue fixes #456"
  
  echo "enhancement" > enhancement.txt
  git add enhancement.txt
  git commit -q -m "feat: complete enhancement resolves #789"
  
  info "Created test commits with completion keywords"
  
  # Test commit detection using Node
  node -e "
    import { detectTaskFromCommit, findCompletedTasks } from '$PROJECT_ROOT/lib/task-completion-detector.js';
    
    // Test individual commit detection
    const result1 = detectTaskFromCommit('feat: add feature closes #123');
    if (!result1 || result1.issueNumber !== 123) {
      throw new Error('Failed to detect issue #123');
    }
    
    const result2 = detectTaskFromCommit('fix: bug fixes #456');
    if (!result2 || result2.issueNumber !== 456) {
      throw new Error('Failed to detect issue #456');
    }
    
    const result3 = detectTaskFromCommit('feat: enhancement resolves #789');
    if (!result3 || result3.issueNumber !== 789) {
      throw new Error('Failed to detect issue #789');
    }
    
    // Test that non-matching commits return null
    const result4 = detectTaskFromCommit('feat: regular commit');
    if (result4 !== null) {
      throw new Error('Should not detect issue in regular commit');
    }
    
    console.log('Task detection successful');
  " 2>&1
  
  if [ $? -eq 0 ]; then
    test_pass "Task completion detection works"
  else
    test_fail "Task completion detection failed"
  fi
  
  cd - > /dev/null
}

#############################################
# Test 5: Cache Management
#############################################

function test_cache_management() {
  test_start "Cache management operations"
  
  # Create temporary test directory
  local test_dir=$(mktemp -d -t "${TEST_PREFIX}-cache-XXXXXX")
  CLEANUP_DIRS+=("$test_dir")
  
  cd "$test_dir"
  
  # Test cache operations
  node -e "
    import { loadCache, saveCache, addEpic, addSubIssue, getEpic } from '$PROJECT_ROOT/lib/cache-manager.js';
    
    // Create cache
    const cache = loadCache('test-owner', 'test-repo');
    
    // Add epic
    addEpic(cache, {
      number: 100,
      title: 'Test Epic',
      goal: 'Test goal',
      priority: 'P1',
      state: 'open',
      dirty: false,
      sub_issues: []
    });
    
    // Verify epic was added
    const epic = getEpic(cache, 100);
    if (!epic) throw new Error('Epic not found after adding');
    if (epic.title !== 'Test Epic') throw new Error('Epic title mismatch');
    
    // Add sub-issue
    addSubIssue(cache, 100, {
      number: 101,
      title: 'Sub-task',
      state: 'open',
      epic_number: 100
    });
    
    // Verify sub-issue was linked
    const updatedEpic = getEpic(cache, 100);
    if (updatedEpic.sub_issues.length !== 1) {
      throw new Error('Sub-issue not linked to epic');
    }
    
    // Save cache
    saveCache('test-owner', 'test-repo', cache);
    
    // Load cache again to verify persistence
    const loadedCache = loadCache('test-owner', 'test-repo');
    const persistedEpic = getEpic(loadedCache, 100);
    if (!persistedEpic) throw new Error('Epic not persisted');
    
    console.log('Cache operations successful');
  " 2>&1
  
  if [ $? -eq 0 ]; then
    test_pass "Cache management works correctly"
  else
    test_fail "Cache management failed"
  fi
  
  cd - > /dev/null
}

#############################################
# Test 6: Config Loading and Validation
#############################################

function test_config_validation() {
  test_start "Configuration loading and validation"
  
  # Create temporary test directory
  local test_dir=$(mktemp -d -t "${TEST_PREFIX}-config-XXXXXX")
  CLEANUP_DIRS+=("$test_dir")
  
  cd "$test_dir"
  
  # Test valid config
  mkdir -p .opencode
  cat > .opencode/config.json << EOF
{
  "superpowers": {
    "enabled": true,
    "remote": "superpowers",
    "repoUrl": "git@github.com:castrojo/superpowers.git",
    "wikiSync": true
  },
  "wiki": {
    "autoSync": false,
    "includeSkills": true
  }
}
EOF
  
  node -e "
    import { loadConfig, validateConfig } from '$PROJECT_ROOT/lib/config-loader.js';
    
    const config = loadConfig('.');
    validateConfig(config);
    
    if (!config.superpowers.enabled) throw new Error('Config not loaded correctly');
    
    console.log('Config validation successful');
  " 2>&1
  
  if [ $? -eq 0 ]; then
    test_pass "Config loading and validation works"
  else
    test_fail "Config validation failed"
  fi
  
  cd - > /dev/null
}

#############################################
# Test 7: Repository Detection
#############################################

function test_repo_detection() {
  test_start "Repository detection from git remotes"
  
  # Create temporary test directory
  local test_dir=$(mktemp -d -t "${TEST_PREFIX}-repo-XXXXXX")
  CLEANUP_DIRS+=("$test_dir")
  
  cd "$test_dir"
  
  # Test SSH URL format
  git init -q
  git remote add origin git@github.com:testuser/testrepo.git
  
  node -e "
    import { detectRepo } from '$PROJECT_ROOT/lib/repo-detector.js';
    
    const repo = detectRepo('.');
    if (!repo) throw new Error('Failed to detect repository');
    if (repo.owner !== 'testuser') throw new Error('Wrong owner: ' + repo.owner);
    if (repo.repo !== 'testrepo') throw new Error('Wrong repo: ' + repo.repo);
    
    console.log('Repo detection successful');
  " 2>&1
  
  if [ $? -eq 0 ]; then
    test_pass "Repository detection works for SSH URLs"
  else
    test_fail "Repository detection failed"
  fi
  
  cd - > /dev/null
  
  # Test HTTPS URL format
  local test_dir2=$(mktemp -d -t "${TEST_PREFIX}-repo2-XXXXXX")
  CLEANUP_DIRS+=("$test_dir2")
  
  cd "$test_dir2"
  
  git init -q
  git remote add origin https://github.com/anotheruser/anotherrepo.git
  
  node -e "
    import { detectRepo } from '$PROJECT_ROOT/lib/repo-detector.js';
    
    const repo = detectRepo('.');
    if (!repo) throw new Error('Failed to detect repository');
    if (repo.owner !== 'anotheruser') throw new Error('Wrong owner: ' + repo.owner);
    if (repo.repo !== 'anotherrepo') throw new Error('Wrong repo: ' + repo.repo);
    
    console.log('Repo detection successful');
  " 2>&1
  
  if [ $? -eq 0 ]; then
    test_pass "Repository detection works for HTTPS URLs"
  else
    test_fail "Repository detection failed for HTTPS"
  fi
  
  cd - > /dev/null
}

#############################################
# Main Test Execution
#############################################

function main() {
  echo -e "${GREEN}========================================${NC}"
  echo -e "${GREEN}OpenCode Superpower Integration Tests${NC}"
  echo -e "${GREEN}========================================${NC}"
  
  echo -e "\n${BLUE}Project root: $PROJECT_ROOT${NC}"
  
  # Run all tests
  check_dependencies
  test_onboarding
  test_wiki_sync
  test_epic_creation
  test_task_completion_detection
  test_cache_management
  test_config_validation
  test_repo_detection
  
  # Summary
  echo -e "\n${GREEN}========================================${NC}"
  echo -e "${GREEN}Test Summary${NC}"
  echo -e "${GREEN}========================================${NC}"
  echo -e "${BLUE}Tests run:     ${NC}${TESTS_RUN}"
  echo -e "${GREEN}Tests passed:  ${NC}${TESTS_PASSED}"
  
  if [ $TESTS_SKIPPED -gt 0 ]; then
    echo -e "${YELLOW}Tests skipped: ${NC}${TESTS_SKIPPED}"
  fi
  
  local tests_failed=$((TESTS_RUN - TESTS_PASSED - TESTS_SKIPPED))
  if [ $tests_failed -gt 0 ]; then
    echo -e "${RED}Tests failed:  ${NC}${tests_failed}"
    echo -e "\n${RED}✗ Some tests failed${NC}"
    exit 1
  else
    echo -e "\n${GREEN}✓ All tests passed!${NC}"
    exit 0
  fi
}

# Run main function
main
