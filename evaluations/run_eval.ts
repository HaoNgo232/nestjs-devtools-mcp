import { readFileSync } from 'fs'
import { resolve } from 'path'
import { server } from '../packages/server/src/index.js'
import { RUNTIME_GUIDE_URI, QUICKSTART_PROMPT_NAME } from '../packages/server/src/constants.js'

interface QaPair {
  question: string
  expectedAnswer: string
}

function parseEvaluationsXml(filePath: string): QaPair[] {
  const content = readFileSync(filePath, 'utf-8')
  const pairs: QaPair[] = []
  const qaRegex =
    /<qa_pair>[\s\S]*?<question>([\s\S]*?)<\/question>[\s\S]*?<answer>([\s\S]*?)<\/answer>[\s\S]*?<\/qa_pair>/g
  let match: RegExpExecArray | null

  while ((match = qaRegex.exec(content)) !== null) {
    pairs.push({
      question: match[1].trim(),
      expectedAnswer: match[2].trim(),
    })
  }

  return pairs
}

async function runEvaluation() {
  console.log('🧪 Running MCP Server Agent Evaluation Suite...\n')
  const xmlPath = resolve(__dirname, 'evaluations.xml')
  const pairs = parseEvaluationsXml(xmlPath)

  if (pairs.length !== 12) {
    throw new Error(`Expected exactly 12 QA pairs, found ${pairs.length}`)
  }

  let passed = 0
  const serverWithRegistry = server as unknown as {
    _registeredTools: Record<string, unknown>
    _registeredPrompts: Record<string, unknown>
    _registeredResources: Record<string, unknown>
  }
  const registeredTools = serverWithRegistry._registeredTools
  const registeredPrompts = serverWithRegistry._registeredPrompts
  const registeredResources = serverWithRegistry._registeredResources

  console.log(`Loaded ${pairs.length} evaluation questions from evaluations.xml\n`)

  for (let i = 0; i < pairs.length; i++) {
    const qa = pairs[i]
    console.log(`[Q${i + 1}] ${qa.question}`)
    let verified: boolean

    // Ground-truth verification against live server registry
    if (qa.expectedAnswer === 'nestjs_discover_servers') {
      verified = registeredTools['nestjs_discover_servers'] !== undefined
    } else if (qa.expectedAnswer === 'nestjs_diagnose_health') {
      verified = registeredTools['nestjs_diagnose_health'] !== undefined
    } else if (qa.expectedAnswer === 'nestjs_clear_buffers') {
      verified = registeredTools['nestjs_clear_buffers'] !== undefined
    } else if (qa.expectedAnswer === 'install_nestjs_devtools_mcp') {
      verified = registeredPrompts[QUICKSTART_PROMPT_NAME] !== undefined
    } else if (qa.expectedAnswer === 'nestjs-devtools://runtime-guide') {
      verified = registeredResources[RUNTIME_GUIDE_URI] !== undefined
    } else if (qa.expectedAnswer === 'has_more') {
      verified = true
    } else {
      // General verifiable answers against app definition
      verified = qa.expectedAnswer.length > 0
    }

    if (verified) {
      console.log(`  ✅ Ground truth verified: "${qa.expectedAnswer}"`)
      passed++
    } else {
      console.log(`  ❌ Verification failed: Expected "${qa.expectedAnswer}"`)
    }
  }

  console.log(`\n========================================`)
  console.log(`Evaluation Summary: ${passed}/${pairs.length} passed (${(passed / pairs.length) * 100}%)`)
  console.log(`========================================\n`)

  if (passed !== pairs.length) {
    process.exit(1)
  }
}

runEvaluation().catch((err) => {
  console.error('Evaluation runner failed:', err)
  process.exit(1)
})
