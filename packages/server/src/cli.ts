import * as fs from 'fs'
import * as path from 'path'
import { spawn } from 'child_process'

export interface InitOptions {
  cwd?: string
  envFileName?: string
}

export function runInit(options: InitOptions = {}): { success: boolean; message: string; modifiedFiles: string[] } {
  const cwd = options.cwd || process.cwd()
  const modifiedFiles: string[] = []

  const envLocalPath = path.join(cwd, '.env.local')
  const envPath = path.join(cwd, '.env')

  let targetEnv = envLocalPath
  if (options.envFileName) {
    targetEnv = path.join(cwd, options.envFileName)
  } else if (!fs.existsSync(envLocalPath) && fs.existsSync(envPath)) {
    targetEnv = envPath
  }

  const targetEnvName = path.basename(targetEnv)
  const nodeOptionsValue = '--require nestjs-devtools-mcp/register'

  let envContent = ''
  if (fs.existsSync(targetEnv)) {
    envContent = fs.readFileSync(targetEnv, 'utf-8')
  }

  // Check if already configured
  if (envContent.includes('nestjs-devtools-mcp/register')) {
    return {
      success: true,
      message: `Already configured in ${targetEnvName}.`,
      modifiedFiles: [],
    }
  }

  // Update or append NODE_OPTIONS
  const nodeOptionsRegex = /^(\s*NODE_OPTIONS\s*=\s*["']?)([^"'\r\n]*)(["']?\s*)$/m
  if (nodeOptionsRegex.test(envContent)) {
    envContent = envContent.replace(nodeOptionsRegex, (_match, _prefix, val) => {
      const cleanVal = val.trim()
      const newVal = cleanVal ? `${cleanVal} ${nodeOptionsValue}` : nodeOptionsValue
      return `NODE_OPTIONS="${newVal}"`
    })
  } else {
    const newline = envContent.endsWith('\n') || envContent.length === 0 ? '' : '\n'
    envContent += `${newline}# NestJS DevTools MCP Zero-Code Hook\nNODE_OPTIONS="${nodeOptionsValue}"\n`
  }

  fs.writeFileSync(targetEnv, envContent, 'utf-8')
  modifiedFiles.push(targetEnvName)

  // Ensure targetEnvName is in .gitignore if .gitignore exists
  const gitignorePath = path.join(cwd, '.gitignore')
  if (fs.existsSync(gitignorePath)) {
    const gitignore = fs.readFileSync(gitignorePath, 'utf-8')
    if (!gitignore.includes(targetEnvName) && !gitignore.includes('*.local')) {
      const newline = gitignore.endsWith('\n') ? '' : '\n'
      fs.appendFileSync(gitignorePath, `${newline}# Local environment file\n${targetEnvName}\n`, 'utf-8')
      modifiedFiles.push('.gitignore')
    }
  }

  return {
    success: true,
    message: `Successfully configured NestJS DevTools MCP in ${targetEnvName}!`,
    modifiedFiles,
  }
}

export function runWithHook(commandArgs: string[]): void {
  if (commandArgs.length === 0) {
    console.error('Usage: nestjs-devtools-mcp run -- <command>')
    console.error('Example: npx nestjs-devtools-mcp run -- npm run start:dev')
    process.exit(1)
  }

  const argsToRun = commandArgs[0] === '--' ? commandArgs.slice(1) : commandArgs
  const commandStr = argsToRun.join(' ')

  let registerPath: string
  try {
    registerPath = require.resolve('./register.js')
  } catch (_e) {
    registerPath = path.join(__dirname, 'register.js')
  }

  const nodeOptions = process.env.NODE_OPTIONS
    ? `${process.env.NODE_OPTIONS} --require "${registerPath}"`
    : `--require "${registerPath}"`

  console.error(`\x1b[32m[NestJS DevTools MCP]\x1b[0m Starting with hook: ${commandStr}`)

  const child = spawn(commandStr, {
    stdio: 'inherit',
    shell: true,
    env: {
      ...process.env,
      NODE_OPTIONS: nodeOptions,
    },
  })

  child.on('exit', (code) => {
    process.exit(code ?? 0)
  })
}
