/**
 * Security Checks - Sprint 3
 * 
 * Критические проверки безопасности при запуске приложения
 * Предотвращает запуск production с небезопасными настройками
 */

import { logger } from './logger';

/**
 * Результат проверки безопасности
 */
interface SecurityCheckResult {
  passed: boolean;
  critical: boolean;
  message: string;
}

/**
 * Выполнить все проверки безопасности
 * @throws Error если критическая проверка не прошла в production
 */
export function runSecurityChecks(): void {
  const isProduction = process.env.NODE_ENV === 'production';
  const results: SecurityCheckResult[] = [];

  logger.info('🔐 Running security checks...');

  // 1. SKIP_TELEGRAM_VALIDATION check
  results.push(checkSkipTelegramValidation(isProduction));

  // 2. JWT_SECRET check
  results.push(checkJwtSecret(isProduction));

  // 3. ENCRYPTION_KEY check
  results.push(checkEncryptionKey(isProduction));

  // 4. BOT_TOKEN check
  results.push(checkBotToken());

  // 5. DATABASE_URL check (не должен содержать пароль в логах)
  results.push(checkDatabaseUrl());

  // Анализируем результаты
  const criticalFailures = results.filter(r => !r.passed && r.critical);
  const warnings = results.filter(r => !r.passed && !r.critical);
  const passed = results.filter(r => r.passed);

  // Выводим результаты
  passed.forEach(r => logger.info(`  ✅ ${r.message}`));
  warnings.forEach(r => logger.warn(`  ⚠️  ${r.message}`));
  criticalFailures.forEach(r => logger.error(`  ❌ ${r.message}`));

  // В production критические ошибки = crash
  if (isProduction && criticalFailures.length > 0) {
    logger.error('🚨 CRITICAL SECURITY ERRORS IN PRODUCTION!');
    logger.error('Application cannot start with these security issues:');
    criticalFailures.forEach(r => logger.error(`  - ${r.message}`));
    throw new Error(`SECURITY: ${criticalFailures.length} critical security check(s) failed`);
  }

  if (criticalFailures.length > 0) {
    logger.warn(`⚠️  ${criticalFailures.length} critical security issue(s) - FIX BEFORE PRODUCTION!`);
  }

  if (warnings.length > 0) {
    logger.warn(`⚠️  ${warnings.length} security warning(s)`);
  }

  logger.info(`🔐 Security checks complete: ${passed.length}/${results.length} passed`);
}

/**
 * Check: SKIP_TELEGRAM_VALIDATION должен быть false в production
 */
function checkSkipTelegramValidation(isProduction: boolean): SecurityCheckResult {
  const skipValidation = process.env.SKIP_TELEGRAM_VALIDATION === 'true';

  if (skipValidation && isProduction) {
    return {
      passed: false,
      critical: true,
      message: 'SKIP_TELEGRAM_VALIDATION=true in PRODUCTION! Anyone can impersonate any user!',
    };
  }

  if (skipValidation) {
    return {
      passed: false,
      critical: false,
      message: 'SKIP_TELEGRAM_VALIDATION=true (OK for development only)',
    };
  }

  return {
    passed: true,
    critical: false,
    message: 'Telegram validation enabled',
  };
}

/**
 * Check: JWT_SECRET должен быть сильным
 */
function checkJwtSecret(isProduction: boolean): SecurityCheckResult {
  const jwtSecret = process.env.JWT_SECRET || '';
  const defaultSecret = 'dev_jwt_secret_change_in_production';

  if (jwtSecret === defaultSecret && isProduction) {
    return {
      passed: false,
      critical: true,
      message: 'JWT_SECRET is DEFAULT value in PRODUCTION! All tokens can be forged!',
    };
  }

  if (jwtSecret === defaultSecret) {
    return {
      passed: false,
      critical: false,
      message: 'JWT_SECRET is default (OK for development only)',
    };
  }

  if (isProduction && jwtSecret.length < 64) {
    return {
      passed: false,
      critical: true,
      message: `JWT_SECRET too weak in PRODUCTION (${jwtSecret.length} chars, need >=64). Tokens can be brute-forced!`,
    };
  }

  if (jwtSecret.length < 32) {
    return {
      passed: false,
      critical: false,
      message: `JWT_SECRET too short (${jwtSecret.length} chars). Recommended: 64+ chars`,
    };
  }

  return {
    passed: true,
    critical: false,
    message: `JWT_SECRET configured (${jwtSecret.length} chars)`,
  };
}

/**
 * Check: ENCRYPTION_KEY для шифрования платежных данных
 */
function checkEncryptionKey(isProduction: boolean): SecurityCheckResult {
  const encryptionKey = process.env.ENCRYPTION_KEY || '';

  if (!encryptionKey && isProduction) {
    return {
      passed: false,
      critical: true,
      message: 'ENCRYPTION_KEY not set in PRODUCTION! Payment data will NOT be encrypted!',
    };
  }

  if (!encryptionKey) {
    return {
      passed: false,
      critical: false,
      message: 'ENCRYPTION_KEY not set (using dev key)',
    };
  }

  // Должен быть 64 hex символа (32 байта)
  if (encryptionKey.length !== 64 || !/^[0-9a-fA-F]+$/.test(encryptionKey)) {
    return {
      passed: false,
      critical: isProduction,
      message: 'ENCRYPTION_KEY invalid format (expected 64 hex chars)',
    };
  }

  return {
    passed: true,
    critical: false,
    message: 'ENCRYPTION_KEY configured correctly',
  };
}

/**
 * Check: BOT_TOKEN должен быть установлен
 */
function checkBotToken(): SecurityCheckResult {
  const botToken = process.env.BOT_TOKEN || '';

  if (!botToken) {
    return {
      passed: false,
      critical: true,
      message: 'BOT_TOKEN not set! Bot cannot start.',
    };
  }

  // Проверяем формат токена (примерно: числа:буквы-цифры)
  if (!/^\d+:[A-Za-z0-9_-]+$/.test(botToken)) {
    return {
      passed: false,
      critical: false,
      message: 'BOT_TOKEN format looks unusual',
    };
  }

  return {
    passed: true,
    critical: false,
    message: 'BOT_TOKEN configured',
  };
}

/**
 * Check: DATABASE_URL не должен логироваться с паролем
 */
function checkDatabaseUrl(): SecurityCheckResult {
  const databaseUrl = process.env.DATABASE_URL || '';

  if (!databaseUrl) {
    return {
      passed: false,
      critical: true,
      message: 'DATABASE_URL not set!',
    };
  }

  // Проверяем что это не пустой URL
  if (databaseUrl.length < 10) {
    return {
      passed: false,
      critical: true,
      message: 'DATABASE_URL looks invalid',
    };
  }

  return {
    passed: true,
    critical: false,
    message: 'DATABASE_URL configured',
  };
}

/**
 * Вспомогательная функция для генерации безопасных ключей
 */
export function generateSecureKey(bytes: number = 32): string {
  const crypto = require('crypto');
  return crypto.randomBytes(bytes).toString('hex');
}

/**
 * Вывод инструкций по генерации ключей
 */
export function printKeyGenerationInstructions(): void {
  console.log('\n📋 To generate secure keys, run:');
  console.log('\n# JWT_SECRET (64+ chars):');
  console.log('node -e "console.log(require(\'crypto\').randomBytes(64).toString(\'hex\'))"');
  console.log('\n# ENCRYPTION_KEY (32 bytes = 64 hex chars):');
  console.log('node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'hex\'))"');
  console.log('');
}
