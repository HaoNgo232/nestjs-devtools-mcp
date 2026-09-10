import * as fs from 'fs'
import * as path from 'path'
import * as os from 'os'
import { runInit } from '../cli'

describe('CLI init command', () => {
  let tempDir: string

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mcp-cli-test-'))
  })

  afterEach(() => {
    try {
      fs.rmSync(tempDir, { recursive: true, force: true })
    } catch (_e) {
      // ignore
    }
  })

  it('should create .env.local with NODE_OPTIONS when no env files exist', () => {
    const result = runInit({ cwd: tempDir })
    expect(result.success).toBe(true)
    expect(result.modifiedFiles).toContain('.env.local')

    const content = fs.readFileSync(path.join(tempDir, '.env.local'), 'utf-8')
    expect(content).toContain('NODE_OPTIONS="--require nestjs-devtools-mcp/register"')
  })

  it('should update existing .env when .env exists and .env.local does not', () => {
    fs.writeFileSync(path.join(tempDir, '.env'), 'PORT=3000\n')

    const result = runInit({ cwd: tempDir })
    expect(result.success).toBe(true)
    expect(result.modifiedFiles).toContain('.env')

    const content = fs.readFileSync(path.join(tempDir, '.env'), 'utf-8')
    expect(content).toContain('PORT=3000')
    expect(content).toContain('NODE_OPTIONS="--require nestjs-devtools-mcp/register"')
  })

  it('should append to existing NODE_OPTIONS in .env without overwriting other flags', () => {
    fs.writeFileSync(path.join(tempDir, '.env'), 'NODE_OPTIONS="--max-old-space-size=4096"\n')

    const result = runInit({ cwd: tempDir })
    expect(result.success).toBe(true)

    const content = fs.readFileSync(path.join(tempDir, '.env'), 'utf-8')
    expect(content).toContain('--max-old-space-size=4096')
    expect(content).toContain('--require nestjs-devtools-mcp/register')
  })

  it('should be idempotent if already configured', () => {
    fs.writeFileSync(path.join(tempDir, '.env.local'), 'NODE_OPTIONS="--require nestjs-devtools-mcp/register"\n')

    const result = runInit({ cwd: tempDir })
    expect(result.success).toBe(true)
    expect(result.modifiedFiles).toHaveLength(0)
    expect(result.message).toContain('Already configured')
  })

  it('should add .env.local to .gitignore if .gitignore exists', () => {
    fs.writeFileSync(path.join(tempDir, '.gitignore'), 'node_modules/\ndist/\n')

    const result = runInit({ cwd: tempDir })
    expect(result.modifiedFiles).toContain('.gitignore')

    const gitignoreContent = fs.readFileSync(path.join(tempDir, '.gitignore'), 'utf-8')
    expect(gitignoreContent).toContain('.env.local')
  })
})
