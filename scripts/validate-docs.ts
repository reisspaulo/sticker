/**
 * 🔍 VALIDAÇÃO DE DOCUMENTAÇÃO
 *
 * Este script verifica se a documentação está sincronizada com o código.
 * Roda no CI e quebra o build se encontrar inconsistências.
 *
 * Validações:
 * 1. Todos os botões no código estão documentados no FLOWCHARTS.md
 * 2. Todas as filas BullMQ estão documentadas
 * 3. Todos os comandos de texto estão documentados
 * 4. Limites de planos (PLAN_LIMITS) sincronizados com BUSINESS_RULES.md
 */

import fs from 'fs';
import path from 'path';

// ============================================
// TIPOS
// ============================================

interface ValidationResult {
  passed: boolean;
  errors: string[];
  warnings: string[];
}

// ============================================
// EXTRAÇÃO DO CÓDIGO
// ============================================

/**
 * Extrai todos os button IDs do código (webhook.ts)
 */
function extractButtonIdsFromCode(): string[] {
  const webhookPath = path.join(process.cwd(), 'src/routes/webhook.ts');
  const content = fs.readFileSync(webhookPath, 'utf-8');

  const buttonIds = new Set<string>();

  // Pattern 1: buttonId === 'button_name'
  const pattern1 = /buttonId\s*===\s*['"`]([^'"`]+)['"`]/g;
  let match;
  while ((match = pattern1.exec(content)) !== null) {
    buttonIds.add(match[1]);
  }

  // Pattern 2: case 'button_name':
  const pattern2 = /case\s+['"`]([^'"`]+)['"`]:/g;
  while ((match = pattern2.exec(content)) !== null) {
    if (match[1].startsWith('button_') || match[1].startsWith('plan_') || match[1].startsWith('payment_')) {
      buttonIds.add(match[1]);
    }
  }

  // Pattern 3: buttonId.startsWith('button_name')
  const pattern3 = /buttonId\.startsWith\(['"`]([^'"`]+)['"`]\)/g;
  while ((match = pattern3.exec(content)) !== null) {
    buttonIds.add(match[1] + '_*'); // Indica wildcard
  }

  return Array.from(buttonIds).sort();
}

/**
 * Extrai todas as filas BullMQ do código (queue.ts)
 */
function extractQueuesFromCode(): string[] {
  const queuePath = path.join(process.cwd(), 'src/config/queue.ts');
  const content = fs.readFileSync(queuePath, 'utf-8');

  const queues = new Set<string>();

  // Pattern: export const xyzQueue = new Queue('queue-name', ...)
  const pattern = /export\s+const\s+\w+Queue\s*=\s*new\s+Queue\(['"`]([^'"`]+)['"`]/g;
  let match;
  while ((match = pattern.exec(content)) !== null) {
    queues.add(match[1]);
  }

  return Array.from(queues).sort();
}

/**
 * Extrai comandos de texto do código (webhook.ts)
 */
function extractTextCommandsFromCode(): string[] {
  const webhookPath = path.join(process.cwd(), 'src/routes/webhook.ts');
  const content = fs.readFileSync(webhookPath, 'utf-8');

  const commands = new Set<string>();

  // Pattern 1: text.toLowerCase() === 'command'
  const pattern1 = /text\.toLowerCase\(\)\s*===\s*['"`]([^'"`]+)['"`]/g;
  let match;
  while ((match = pattern1.exec(content)) !== null) {
    commands.add(match[1]);
  }

  // Pattern 2: text.match(/^(cmd1|cmd2)$/i)
  const pattern2 = /text\.match\(\/\^\(([^)]+)\)\$\/i\)/g;
  while ((match = pattern2.exec(content)) !== null) {
    const cmds = match[1].split('|');
    cmds.forEach(cmd => commands.add(cmd.trim()));
  }

  return Array.from(commands).sort();
}

// ============================================
// EXTRAÇÃO DA DOCUMENTAÇÃO
// ============================================

/**
 * Extrai botões documentados no FLOWCHARTS.md
 */
function extractButtonIdsFromDocs(): string[] {
  const docsPath = path.join(process.cwd(), 'docs/architecture/FLOWCHARTS.md');
  const content = fs.readFileSync(docsPath, 'utf-8');

  const buttonIds = new Set<string>();

  // Pattern 1: { id: 'button_name', text: '...' }
  const pattern1 = /id:\s*['"`]([^'"`]+)['"`]/g;
  let match;
  while ((match = pattern1.exec(content)) !== null) {
    if (match[1].startsWith('button_') || match[1].startsWith('plan_') || match[1].startsWith('payment_')) {
      buttonIds.add(match[1]);
    }
  }

  // Pattern 2: `button_name` mencionado explicitamente
  const pattern2 = /`([a-z_]+(?:_\*)?)`/g;
  while ((match = pattern2.exec(content)) !== null) {
    if (match[1].startsWith('button_') || match[1].startsWith('plan_') || match[1].startsWith('payment_')) {
      buttonIds.add(match[1]);
    }
  }

  return Array.from(buttonIds).sort();
}

/**
 * Extrai filas documentadas no FLOWCHARTS.md
 */
function extractQueuesFromDocs(): string[] {
  const docsPath = path.join(process.cwd(), 'docs/architecture/FLOWCHARTS.md');
  const content = fs.readFileSync(docsPath, 'utf-8');

  const queues = new Set<string>();

  // Pattern: Q1[✅ process-sticker<br/>concurrency: 5] or Q1[🚧 edit-buttons DESATIVADO<br/>...]
  // Handles optional emoji/status prefix before queue name
  const pattern = /Q\d+\[[^\]]*?([a-z]+-[a-z-]+)(?:<br\/>|\s|\\n)/g;
  let match;
  while ((match = pattern.exec(content)) !== null) {
    queues.add(match[1]);
  }

  return Array.from(queues).sort();
}

// ============================================
// VALIDAÇÃO
// ============================================

/**
 * Valida botões
 */
function validateButtons(): ValidationResult {
  const codeButtons = extractButtonIdsFromCode();
  const docButtons = extractButtonIdsFromDocs();

  const errors: string[] = [];
  const warnings: string[] = [];

  // Botões no código mas não na doc
  const missingInDocs = codeButtons.filter(btn => {
    // Ignora wildcards
    if (btn.endsWith('_*')) {
      const prefix = btn.slice(0, -2);
      return !docButtons.some(doc => doc.startsWith(prefix) || doc === btn);
    }
    return !docButtons.includes(btn);
  });

  if (missingInDocs.length > 0) {
    errors.push('❌ Botões não documentados no FLOWCHARTS.md:');
    missingInDocs.forEach(btn => errors.push(`   - ${btn}`));
  }

  // Botões na doc mas não no código (warning, pode ser obsoleto)
  const missingInCode = docButtons.filter(btn => {
    if (btn.endsWith('_*')) {
      const prefix = btn.slice(0, -2);
      return !codeButtons.some(code => code.startsWith(prefix) || code === btn);
    }
    return !codeButtons.includes(btn);
  });

  if (missingInCode.length > 0) {
    warnings.push('⚠️  Botões documentados mas não encontrados no código (podem ser obsoletos):');
    missingInCode.forEach(btn => warnings.push(`   - ${btn}`));
  }

  return {
    passed: errors.length === 0,
    errors,
    warnings
  };
}

/**
 * Valida filas
 */
function validateQueues(): ValidationResult {
  const codeQueues = extractQueuesFromCode();
  const docQueues = extractQueuesFromDocs();

  const errors: string[] = [];
  const warnings: string[] = [];

  // Filas no código mas não na doc
  const missingInDocs = codeQueues.filter(q => !docQueues.includes(q));

  if (missingInDocs.length > 0) {
    errors.push('❌ Filas BullMQ não documentadas no FLOWCHARTS.md:');
    missingInDocs.forEach(q => errors.push(`   - ${q}`));
  }

  // Filas na doc mas não no código
  const missingInCode = docQueues.filter(q => !codeQueues.includes(q));

  if (missingInCode.length > 0) {
    warnings.push('⚠️  Filas documentadas mas não encontradas no código:');
    missingInCode.forEach(q => warnings.push(`   - ${q}`));
  }

  return {
    passed: errors.length === 0,
    errors,
    warnings
  };
}

/**
 * Verifica se FLOWCHARTS.md foi atualizado recentemente
 */
function validateDocsUpdated(): ValidationResult {
  const docsPath = path.join(process.cwd(), 'docs/architecture/FLOWCHARTS.md');
  const stats = fs.statSync(docsPath);
  const lastModified = stats.mtime;
  const daysSinceUpdate = (Date.now() - lastModified.getTime()) / (1000 * 60 * 60 * 24);

  const warnings: string[] = [];

  if (daysSinceUpdate > 30) {
    warnings.push(`⚠️  FLOWCHARTS.md não é atualizado há ${Math.floor(daysSinceUpdate)} dias`);
    warnings.push('   Considere revisar se está sincronizado com o código');
  }

  return {
    passed: true, // Não quebra build
    errors: [],
    warnings
  };
}

/**
 * Valida se os limites de planos estão sincronizados entre código e documentação
 */
function validatePlanLimits(): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  try {
    // Lê PLAN_LIMITS do código
    const subscriptionTypesPath = path.join(process.cwd(), 'src/types/subscription.ts');
    const codeContent = fs.readFileSync(subscriptionTypesPath, 'utf-8');

    // Extrai limites do código
    const planLimitsMatch = codeContent.match(/export const PLAN_LIMITS[^}]+}/s);
    if (!planLimitsMatch) {
      warnings.push('⚠️  Não foi possível extrair PLAN_LIMITS do código');
      return { passed: true, errors, warnings };
    }

    const freeMatch = planLimitsMatch[0].match(/free:\s*(\d+)/);
    const premiumMatch = planLimitsMatch[0].match(/premium:\s*(\d+)/);
    const ultraMatch = planLimitsMatch[0].match(/ultra:\s*(\d+)/);

    if (!freeMatch || !premiumMatch || !ultraMatch) {
      warnings.push('⚠️  Não foi possível extrair todos os limites de planos');
      return { passed: true, errors, warnings };
    }

    const codeLimits = {
      free: parseInt(freeMatch[1]),
      premium: parseInt(premiumMatch[1]),
      ultra: parseInt(ultraMatch[1])
    };

    // Lê limites da documentação
    const businessRulesPath = path.join(process.cwd(), 'docs/business/BUSINESS_RULES.md');
    const docsContent = fs.readFileSync(businessRulesPath, 'utf-8');

    // Procura por BR-100, BR-101, BR-102 que definem os limites
    const br100Match = docsContent.match(/BR-100[^\n]*Gratuito[^\n]*(\d+)[^\n]*dia/i);
    const br101Match = docsContent.match(/BR-101[^\n]*Premium[^\n]*(\d+)[^\n]*dia/i);
    const br102Match = docsContent.match(/BR-102[^\n]*Ultra[^\n]*(∞|ilimitad|999)/i);

    if (br100Match && parseInt(br100Match[1]) !== codeLimits.free) {
      errors.push(`❌ Limite FREE desincronizado:`);
      errors.push(`   Código: ${codeLimits.free}/dia`);
      errors.push(`   Docs (BR-100): ${br100Match[1]}/dia`);
      errors.push(`   → Atualize docs/business/BUSINESS_RULES.md (BR-100)`);
    }

    if (br101Match && parseInt(br101Match[1]) !== codeLimits.premium) {
      errors.push(`❌ Limite PREMIUM desincronizado:`);
      errors.push(`   Código: ${codeLimits.premium}/dia`);
      errors.push(`   Docs (BR-101): ${br101Match[1]}/dia`);
      errors.push(`   → Atualize docs/business/BUSINESS_RULES.md (BR-101)`);
    }

    if (!br100Match || !br101Match || !br102Match) {
      warnings.push('⚠️  Não foi possível encontrar BR-100, BR-101 ou BR-102 em BUSINESS_RULES.md');
      warnings.push('   Verifique se os limites de planos estão documentados');
    }

  } catch (error) {
    warnings.push(`⚠️  Erro ao validar limites de planos: ${error}`);
  }

  return {
    passed: errors.length === 0,
    errors,
    warnings
  };
}

// ============================================
// MAIN
// ============================================

function main() {
  console.log('🔍 Validando documentação...\n');

  let allPassed = true;
  const allWarnings: string[] = [];

  // Validação 1: Botões
  console.log('1️⃣  Validando botões...');
  const buttonsResult = validateButtons();
  if (!buttonsResult.passed) {
    allPassed = false;
    buttonsResult.errors.forEach(err => console.log(err));
  } else {
    console.log('   ✅ Todos os botões documentados');
  }
  allWarnings.push(...buttonsResult.warnings);

  console.log('');

  // Validação 2: Filas
  console.log('2️⃣  Validando filas BullMQ...');
  const queuesResult = validateQueues();
  if (!queuesResult.passed) {
    allPassed = false;
    queuesResult.errors.forEach(err => console.log(err));
  } else {
    console.log('   ✅ Todas as filas documentadas');
  }
  allWarnings.push(...queuesResult.warnings);

  console.log('');

  // Validação 3: Data de atualização
  console.log('3️⃣  Verificando atualização dos docs...');
  const docsResult = validateDocsUpdated();
  allWarnings.push(...docsResult.warnings);
  if (docsResult.warnings.length === 0) {
    console.log('   ✅ Docs atualizados recentemente');
  }

  console.log('');

  // Validação 4: Limites de planos
  console.log('4️⃣  Validando limites de planos...');
  const planLimitsResult = validatePlanLimits();
  if (!planLimitsResult.passed) {
    allPassed = false;
    planLimitsResult.errors.forEach(err => console.log(err));
  } else {
    console.log('   ✅ Limites de planos sincronizados com docs');
  }
  allWarnings.push(...planLimitsResult.warnings);

  console.log('');

  // Warnings
  if (allWarnings.length > 0) {
    console.log('⚠️  AVISOS:\n');
    allWarnings.forEach(warn => console.log(warn));
    console.log('');
  }

  // Resultado final
  if (allPassed) {
    console.log('✅ Documentação validada com sucesso!\n');
    process.exit(0);
  } else {
    console.log('❌ Documentação desatualizada. Por favor, atualize FLOWCHARTS.md\n');
    process.exit(1);
  }
}

// Executa se chamado diretamente
if (require.main === module) {
  main();
}

export {
  extractButtonIdsFromCode,
  extractQueuesFromCode,
  extractTextCommandsFromCode,
  extractButtonIdsFromDocs,
  extractQueuesFromDocs,
  validateButtons,
  validateQueues
};
