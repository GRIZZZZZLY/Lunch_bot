const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'src/utils/telegram-auth.ts');
let content = fs.readFileSync(filePath, 'utf8');

// Fix 1: parseInitData - использовать декодированные значения
// ВАЖНО: Заменяем полный блок parseInitData целиком
const oldParseInitDataBlock = `function parseInitData(initData: string): TelegramInitData | null {
  try {
    // Сохраняем оригинальные пары ключ=значение БЕЗ декодирования
    const rawPairs: Record<string, string> = {};
    const pairs = initData.split('&');

    for (const pair of pairs) {
      const eqIndex = pair.indexOf('=');
      if (eqIndex === -1) continue;

      const key = pair.substring(0, eqIndex);
      const rawValue = pair.substring(eqIndex + 1); // URL-encoded значение
      rawPairs[key] = rawValue;
    }

    // Теперь парсим через URLSearchParams для декодированных значений
    const params = new URLSearchParams(initData);
    const result: any = {
      _rawPairs: rawPairs, // Сохраняем оригинальные URL-encoded значения
    };

    for (const [key, value] of params.entries()) {
      if (key === 'user') {
        try {
          result[key] = JSON.parse(value);
          // Сохраняем оригинальную URL-encoded строку (НЕ декодированную)
          result['_userRaw'] = rawPairs['user'];
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
}`;

const newParseInitDataBlock = `function parseInitData(initData: string): TelegramInitData | null {
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
}`;

if (!content.includes(oldParseInitDataBlock)) {
  console.error('❌ Could not find oldParseInitDataBlock');
  process.exit(1);
}

content = content.replace(oldParseInitDataBlock, newParseInitDataBlock);

// Fix 2: verifyTelegramHash - заменить rawPairs на decodedPairs
content = content.replace(
  '// Получаем оригинальные URL-encoded значения\n    const rawPairs = (data as any)._rawPairs || {};',
  '// ✅ Получаем декодированные значения для data-check-string\n    const decodedPairs = (data as any)._decodedPairs || {};'
);

content = content.replace(
  'const { hash, signature, _userRaw, _rawPairs, ...params } = data;',
  'const { hash, signature, _decodedPairs, ...params } = data;'
);

content = content.replace(
  `    // ✅ FIX: Создаем строку для проверки используя ОРИГИНАЛЬНЫЕ URL-encoded значения
    // Telegram подписывает именно их, БЕЗ декодирования!
    const dataCheckString = Object.keys(params)
      .filter(key => key !== 'hash' && key !== 'signature' && key !== '_userRaw' && key !== '_rawPairs')
      .sort()
      .map(key => {
        // Используем оригинальное URL-encoded значение из rawPairs
        const rawValue = rawPairs[key];
        if (rawValue !== undefined) {
          return \`\${key}=\${rawValue}\`; // ✅ Оригинальное значение
        }

        // Fallback для декодированных значений (не должно использоваться)
        const value = params[key];
        if (typeof value === 'object') {
          return \`\${key}=\${JSON.stringify(value)}\`;
        }
        return \`\${key}=\${value}\`;
      })
      .join('\\n');`,
  `    // ✅ FIX: Создаем строку для проверки используя ДЕКОДИРОВАННЫЕ значения
    // По алгоритму Telegram: decodeURIComponent всей строки, потом split
    const dataCheckString = Object.keys(params)
      .filter(key => key !== 'hash' && key !== 'signature' && key !== '_decodedPairs')
      .sort()
      .map(key => {
        // Используем декодированное значение из decodedPairs
        const decodedValue = decodedPairs[key];
        if (decodedValue !== undefined) {
          return \`\${key}=\${decodedValue}\`; // ✅ Декодированное значение
        }

        // Fallback для обычных значений (не должно использоваться)
        const value = params[key];
        if (typeof value === 'object') {
          return \`\${key}=\${JSON.stringify(value)}\`;
        }
        return \`\${key}=\${value}\`;
      })
      .join('\\n');`
);

// Fix 3: Update debug log
content = content.replace(
  `    console.log('📝 DataCheckString:', {
      full: dataCheckString,
      length: dataCheckString.length,
      fields: Object.keys(params).sort(),
      usingRawPairs: !!Object.keys(rawPairs).length,
      rawPairsKeys: Object.keys(rawPairs),
      userValuePreview: rawPairs['user']?.substring(0, 100) + '...'
    });`,
  `    console.log('📝 DataCheckString:', {
      full: dataCheckString,
      length: dataCheckString.length,
      fields: Object.keys(params).sort(),
      usingDecodedPairs: !!Object.keys(decodedPairs).length,
      decodedPairsKeys: Object.keys(decodedPairs),
      userValuePreview: decodedPairs['user']?.substring(0, 100) + '...'
    });`
);

fs.writeFileSync(filePath, content, 'utf8');
console.log('✅ File fixed successfully!');
console.log('Changes made:');
console.log('- parseInitData now uses decodeURIComponent() first');
console.log('- verifyTelegramHash uses _decodedPairs instead of _rawPairs');
console.log('- dataCheckString uses decoded values');
console.log('- Updated debug logging');
