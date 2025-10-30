#!/usr/bin/env python3
import re

with open('src/utils/telegram-auth.ts', 'r', encoding='utf-8') as f:
    content = f.read()

# Fix 1: parseInitData function
old_pattern_1 = r'''function parseInitData\(initData: string\): TelegramInitData \| null \{
  try \{
    // Сохраняем оригинальные пары ключ=значение БЕЗ декодирования
    const rawPairs: Record<string, string> = \{\};
    const pairs = initData\.split\('&'\);

    for \(const pair of pairs\) \{
      const eqIndex = pair\.indexOf\('='\);
      if \(eqIndex === -1\) continue;

      const key = pair\.substring\(0, eqIndex\);
      const rawValue = pair\.substring\(eqIndex \+ 1\); // URL-encoded значение
      rawPairs\[key\] = rawValue;
    \}

    // Теперь парсим через URLSearchParams для декодированных значений
    const params = new URLSearchParams\(initData\);
    const result: any = \{
      _rawPairs: rawPairs, // Сохраняем оригинальные URL-encoded значения
    \};

    for \(const \[key, value\] of params\.entries\(\)\) \{
      if \(key === 'user'\) \{
        try \{
          result\[key\] = JSON\.parse\(value\);
          // Сохраняем оригинальную URL-encoded строку \(НЕ декодированную\)
          result\['_userRaw'\] = rawPairs\['user'\];
        \} catch \{
          logger\.warn\('Failed to parse user data from initData'\);
          return null;
        \}
      \} else if \(key === 'auth_date'\) \{
        result\[key\] = parseInt\(value\);
      \} else \{
        result\[key\] = value;
      \}
    \}

    // Проверяем наличие hash ИЛИ signature \(поддержка старых и новых версий SDK\)
    if \(\(!result\.hash && !result\.signature\) \|\| !result\.auth_date\) \{
      logger\.warn\('Missing required fields in initData \(hash/signature and auth_date\)'\);
      return null;
    \}

    return result as TelegramInitData;

  \} catch \(error\) \{
    logger\.error\('Error parsing initData:', error\);
    return null;
  \}
\}'''

new_code_1 = '''function parseInitData(initData: string): TelegramInitData | null {
  try {
    // ✅ FIX: Сначала URL-декодируем ВСЮ строку (алгоритм Telegram)
    // Источник: https://gist.github.com/konstantin24121/49da5d8023532d66cc4db1136435a885
    const decoded = decodeURIComponent(initData);

    // Сохраняем декодированные пары для data-check-string
    const decodedPairs: Record<string, string> = {};
    const pairs = decoded.split('&');

    for (const pair of pairs) {
      const eqIndex = pair.indexOf('=');
      if (eqIndex === -1) continue;

      const key = pair.substring(0, eqIndex);
      const value = pair.substring(eqIndex + 1); // Декодированное значение
      decodedPairs[key] = value;
    }

    // Парсим через URLSearchParams для получения декодированных значений
    const params = new URLSearchParams(initData);
    const result: any = {
      _decodedPairs: decodedPairs, // ✅ Декодированные значения для проверки подписи
    };

    for (const [key, value] of params.entries()) {
      if (key === 'user') {
        try {
          result[key] = JSON.parse(value);
        } catch {
          logger.warn('Failed to parse user data from initData');
          return null;
        }
      } else if (key === 'auth_date') {
        result[key] = parseInt(value);
      } else {
        result[key] = value;
      }
    }

    // Проверяем наличие hash ИЛИ signature (поддержка старых и новых версий SDK)
    if ((!result.hash && !result.signature) || !result.auth_date) {
      logger.warn('Missing required fields in initData (hash/signature and auth_date)');
      return null;
    }

    return result as TelegramInitData;

  } catch (error) {
    logger.error('Error parsing initData:', error);
    return null;
  }
}'''

content = re.sub(old_pattern_1, new_code_1, content, flags=re.MULTILINE)

# Fix 2: verifyTelegramHash - replace rawPairs with decodedPairs
content = content.replace('_rawPairs', '_decodedPairs')
content = content.replace('rawPairs', 'decodedPairs')
content = content.replace('usingRawPairs', 'usingDecodedPairs')
content = content.replace('rawPairsKeys', 'decodedPairsKeys')
content = content.replace('_userRaw', '_userDecoded')

# Fix comments
content = content.replace(
    '// Получаем оригинальные URL-encoded значения',
    '// ✅ Получаем декодированные значения для data-check-string'
)
content = content.replace(
    '// ✅ FIX: Создаем строку для проверки используя ОРИГИНАЛЬНЫЕ URL-encoded значения\n    // Telegram подписывает именно их, БЕЗ декодирования!',
    '// ✅ FIX: Создаем строку для проверки используя ДЕКОДИРОВАННЫЕ значения\n    // По алгоритму Telegram: decodeURIComponent всей строки, потом split'
)

# Fix variable names in dataCheckString
content = content.replace('const rawValue =', 'const decodedValue =')
content = content.replace('if (rawValue !== undefined)', 'if (decodedValue !== undefined)')
content = content.replace('{key}=${rawValue}', '{key}=${decodedValue}')

with open('src/utils/telegram-auth.ts', 'w', encoding='utf-8') as f:
    f.write(content)

print('✅ File fixed successfully!')
