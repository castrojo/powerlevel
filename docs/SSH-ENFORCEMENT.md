# SSH Remote Enforcement

Powerlevel automatically ensures all git remotes use SSH instead of HTTPS for GitHub repositories. This provides better security and authentication for git operations.

## Why SSH?

Using SSH for git remotes offers several advantages:

1. **Key-based authentication**: No need to enter credentials repeatedly
2. **Better security**: SSH keys are more secure than password/token authentication
3. **Consistent authentication**: Works seamlessly with SSH agent and key management
4. **Required for write operations**: Many workflows require SSH for pushing changes

## Automatic Conversion

When Powerlevel initializes in a git repository, it automatically:

1. Scans all configured git remotes
2. Detects any GitHub remotes using HTTPS URLs
3. Converts them to SSH format (git@github.com:owner/repo.git)
4. Reports the conversions to the console

### Example Output

```
Initializing Powerlevel plugin...
✓ GitHub CLI authenticated
✓ Detected repository: castrojo/powerlevel
✓ Converted 1 remote(s) from HTTPS to SSH
  - origin: https://github.com/castrojo/powerlevel.git → git@github.com:castrojo/powerlevel.git
✓ Labels verified
```

## Manual Conversion

You can also manually convert remotes using the remote-manager utilities:

```javascript
import { ensureRemotesUseSSH } from './lib/remote-manager.js';

// Convert all HTTPS remotes to SSH in a repository
const conversions = ensureRemotesUseSSH('/path/to/repo');

console.log(`Converted ${conversions.length} remotes`);
conversions.forEach(conv => {
  console.log(`${conv.remote}: ${conv.oldUrl} → ${conv.newUrl}`);
});
```

## URL Format Conversion

Powerlevel converts GitHub URLs using these patterns:

| HTTPS Format | SSH Format |
|-------------|-----------|
| `https://github.com/owner/repo.git` | `git@github.com:owner/repo.git` |
| `https://github.com/owner/repo` | `git@github.com:owner/repo.git` |

## Prerequisites

For SSH remotes to work, you need:

1. **SSH key configured**: Generate an SSH key if you don't have one
   ```bash
   ssh-keygen -t ed25519 -C "your_email@example.com"
   ```

2. **SSH key added to GitHub**: Add your public key to your GitHub account
   - Go to GitHub Settings → SSH and GPG keys
   - Click "New SSH key"
   - Paste your public key (~/.ssh/id_ed25519.pub)

3. **SSH agent running**: Ensure your SSH agent has your key loaded
   ```bash
   eval "$(ssh-agent -s)"
   ssh-add ~/.ssh/id_ed25519
   ```

4. **Test SSH connection**:
   ```bash
   ssh -T git@github.com
   ```

## API Reference

### `convertHttpsToSsh(httpsUrl)`

Converts an HTTPS GitHub URL to SSH format.

**Parameters:**
- `httpsUrl` (string): GitHub HTTPS URL to convert

**Returns:**
- (string | null): SSH URL or null if not a GitHub HTTPS URL

**Example:**
```javascript
import { convertHttpsToSsh } from './lib/remote-manager.js';

const sshUrl = convertHttpsToSsh('https://github.com/owner/repo.git');
console.log(sshUrl); // git@github.com:owner/repo.git
```

### `setRemoteUrl(remoteName, url, cwd, client)`

Sets the URL of a git remote.

**Parameters:**
- `remoteName` (string): Name of the remote (e.g., 'origin')
- `url` (string): New URL for the remote
- `cwd` (string): Repository path
- `client` (Object, optional): OpenCode SDK client for logging

**Throws:**
- Error if remote doesn't exist or git command fails

**Example:**
```javascript
import { setRemoteUrl } from './lib/remote-manager.js';

setRemoteUrl('origin', 'git@github.com:owner/repo.git', '/path/to/repo');
```

### `ensureRemotesUseSSH(cwd, client)`

Ensures all git remotes use SSH instead of HTTPS. Automatically converts HTTPS GitHub URLs to SSH format.

**Parameters:**
- `cwd` (string): Repository path
- `client` (Object, optional): OpenCode SDK client for logging

**Returns:**
- Array of conversion objects: `[{remote, oldUrl, newUrl}, ...]`

**Example:**
```javascript
import { ensureRemotesUseSSH } from './lib/remote-manager.js';

const conversions = ensureRemotesUseSSH('/path/to/repo');
if (conversions.length > 0) {
  console.log('Converted remotes:');
  conversions.forEach(conv => {
    console.log(`  ${conv.remote}: ${conv.oldUrl} → ${conv.newUrl}`);
  });
}
```

## Implementation Details

The SSH enforcement feature is implemented in:

- **lib/remote-manager.js**: Core utilities for URL conversion and remote management
- **plugin.js**: Integration into Powerlevel initialization
- **test/remote-manager.test.js**: Comprehensive test coverage

### Integration Points

SSH enforcement runs during plugin initialization:

```javascript
// In plugin.js PowerlevelPlugin() function
const conversions = ensureRemotesUseSSH(cwd);
if (conversions.length > 0) {
  console.log(`✓ Converted ${conversions.length} remote(s) from HTTPS to SSH`);
}
```

This ensures all remotes are using SSH before any other Powerlevel operations occur.

## Troubleshooting

### "Permission denied (publickey)" Error

This means your SSH key isn't properly configured:

1. Verify SSH key exists: `ls -la ~/.ssh/`
2. Add key to SSH agent: `ssh-add ~/.ssh/id_ed25519`
3. Test GitHub connection: `ssh -T git@github.com`
4. Verify key is added to GitHub account

### Remote Not Converting

If a remote isn't being converted:

1. Check it's a GitHub URL: Only GitHub HTTPS URLs are converted
2. Verify remote exists: `git remote -v`
3. Check for errors in Powerlevel output
4. Manually convert: `git remote set-url origin git@github.com:owner/repo.git`

### Multiple GitHub Accounts

If you use multiple GitHub accounts with different SSH keys:

1. Configure SSH config (~/.ssh/config):
   ```
   Host github.com-work
     HostName github.com
     User git
     IdentityFile ~/.ssh/id_ed25519_work
   
   Host github.com-personal
     HostName github.com
     User git
     IdentityFile ~/.ssh/id_ed25519_personal
   ```

2. Use host aliases in remote URLs:
   ```bash
   git remote set-url origin git@github.com-work:company/repo.git
   ```

## See Also

- [GitHub SSH Key Documentation](https://docs.github.com/en/authentication/connecting-to-github-with-ssh)
- [remote-manager.js API](../lib/remote-manager.js)
- [Plugin Architecture](../README.md#plugin-architecture)
