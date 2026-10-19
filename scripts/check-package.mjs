/** Build and inspect the real package archive, failing on missing assets or private build residue. */
import { execFileSync } from 'node:child_process'
import { mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, posix } from 'node:path'

/** Inspect package contents using tar without extracting executable files.
 * @param archive Absolute archive path. @returns Completion; throws on unsafe or incomplete contents.
 */
function checkArchive(archive) {
  const entries = execFileSync('tar', ['-tzf', archive], { encoding: 'utf8' }).trim().split('\n')
  const required = ['lib/index.js', 'lib/client.js', 'server/workbuddy_service.py', 'server/session.py',
    'server/protocol.py', 'server/pricing.py', 'cordis.patch.yml', 'pyproject.toml', 'uv.lock',
    'README.md', 'README.zh-CN.md', 'LICENSE', 'CONTRIBUTING.md', 'SECURITY.md', 'SUPPORT.md',
    'deploy/README.md', 'deploy/Caddyfile', 'deploy/gateway.env.example', 'deploy/workbuddy2api.conf',
    'deploy/verify_gateway.py', 'docs/OPERATIONS.md', 'docs/screenshots/settings-overview.png',
    'docs/screenshots/deepseek-models.png', 'docs/screenshots/free-models.png']
  const missing = required.filter(path => !entries.includes(`package/${path}`))
  const forbidden = entries.filter(path => /(?:^|\/)(?:__pycache__|node_modules|\.git|\.venv|\.env(?:\.[^/]*)?|session\.json|gateway-key|gateway\.env|test_[^/]*\.py)(?:\/|$)|\.(?:pyc|pem|key|log|jsonl)$/.test(path))
  if (missing.length || forbidden.length) {
    throw new Error(`Invalid package contents: missing=${missing.join(', ')} forbidden=${forbidden.join(', ')}`)
  }
  for (const path of entries.filter(path => path.endsWith('.md'))) checkDocument(archive, path, entries)
  console.log(`Package verified: ${entries.length} files, required assets included, no private build residue`)
}

/** Verify relative Markdown links against the files actually shipped.
 * @param archive Package path. @param path Markdown entry. @param entries Complete archive file list.
 * @returns Completion; throws for a broken relative link.
 */
function checkDocument(archive, path, entries) {
  const content = execFileSync('tar', ['-xOf', archive, path], { encoding: 'utf8' })
  for (const match of content.matchAll(/!?\[[^\]]*\]\(([^)]+)\)/g)) {
    const target = match[1].split('#')[0]
    if (!target || /^[a-z][a-z\d+.-]*:/i.test(target)) continue
    const resolved = posix.join(path.slice(0, path.lastIndexOf('/')), target)
    if (!entries.includes(resolved)) throw new Error(`Broken package link in ${path}: ${target}`)
  }
}

const destination = mkdtempSync(join(tmpdir(), 'dsh-workbuddy-package-'))
try {
  execFileSync('pnpm', ['pack', '--pack-destination', destination], { stdio: 'inherit' })
  const { name, version } = JSON.parse(readFileSync('package.json', 'utf8'))
  checkArchive(join(destination, `${name}-${version}.tgz`))
} finally {
  rmSync(destination, { recursive: true, force: true })
}
