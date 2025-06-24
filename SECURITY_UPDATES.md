# Security Updates Summary

This PR addresses critical security vulnerabilities in the Azure Static Web Apps CLI dependencies.

## Vulnerabilities Fixed

### Before: 21 vulnerabilities

- 1 critical
- 4 high
- 11 moderate
- 5 low

### After: 9 vulnerabilities

- 0 critical ✅
- 1 high
- 7 moderate
- 1 low

## Updates Applied

1. **cookie**: `^0.5.0` → `^0.7.0`

   - Fixed: CVE-2024-47764 - Critical vulnerability allowing injection of unexpected key-value pairs
   - This was the most critical security issue

2. **vitest**: `^2.0.2` → `^2.1.9`

   - Fixed: Remote Code Execution vulnerability when accessing malicious websites while Vitest API server is listening
   - This was a critical vulnerability in the development dependencies

3. **npm audit fix**: Automatically updated multiple dependencies including:
   - Various @babel packages
   - @octokit packages (fixed ReDoS vulnerabilities)
   - axios (fixed SSRF vulnerability)
   - nanoid (fixed predictable results vulnerability)
   - rollup (fixed DOM Clobbering XSS)
   - send/serve-static (fixed template injection XSS)
   - tar-fs (fixed path traversal vulnerabilities)
   - And many others

## Remaining Vulnerabilities

The remaining 9 vulnerabilities require major version updates that could introduce breaking changes:

1. **cypress** (9.x → 14.x): Major update with significant API changes
2. **esbuild/vite/vitest**: Would require updating to vitest 3.x
3. **brace-expansion & cross-spawn**: Bundled with npm itself

These should be addressed in separate PRs with thorough testing.

## Testing

- ✅ All unit tests pass
- ✅ Build completes successfully
- ✅ No breaking changes introduced

## Impact

This update significantly improves the security posture of the project by:

- Eliminating all critical vulnerabilities
- Reducing high-severity vulnerabilities from 4 to 1
- Reducing overall vulnerabilities by 57% (from 21 to 9)
