const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'src/utils/telegram-auth.ts');
let content = fs.readFileSync(filePath, 'utf8');

// Fix 1: parseInitData - использовать декодированные значения
const oldParseInitData = `  try {
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
  }`;

const newParseInitData = `  try {
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
  }`;

content = content.replace(oldParseInitData, newParseInitData);

// Fix 2: verifyTelegramHash - использовать _decodedPairs
content = content.replace(/_rawPairs/g, '_decodedPairs');
content = content.replace(/rawPairs/g, 'decodedPairs');
content = content.replace(/usingRawPairs/g, 'usingDecodedPairs');
content = content.replace(/rawPairsKeys/g, 'decodedPairsKeys');
content = content.replace(/_userRaw/g, '_userDecoded');

// Fix 3: Обновить комментарии
content = content.replace(
  '// Получаем оригинальные URL-encoded значения',
  '// ✅ Получаем декодированные значения для data-check-string'
);
content = content.replace(
  '// Удаляем hash, signature и служебные поля',
  '// Удаляем hash, signature и служебные поля (_decodedPairs)'
);
content = content.replace(
  '// ✅ FIX: Создаем строку для проверки используя ОРИГИНАЛЬНЫЕ URL-encoded значения',
  '// ✅ FIX: Создаем строку для проверки используя ДЕКОДИРОВАННЫЕ значения'
);
content = content.replace(
  '// Telegram подписывает именно их, БЕЗ декодирования!',
  '// По алгоритму Telegram: decodeURIComponent всей строки, потом split'
);
content = content.replace(
  '// Используем оригинальное URL-encoded значение из rawPairs',
  '// Используем декодированное значение из decodedPairs'
);
content = content.replace(
  'return `${key}=${rawValue}`; // ✅ Оригинальное значение',
  'return `${key}=${decodedValue}`; // ✅ Декодированное значение'
);

// Fix 4: Переменные в dataCheckString
content = content.replace(
  'const rawValue = rawPairs[key];',
  'const decodedValue = decodedPairs[key];'
);
content = content.replace(
  'if (rawValue !== undefined) {',
  'if (decodedValue !== undefined) {'
);

fs.writeFileSync(filePath, content, 'utf8');
console.log('✅ File fixed successfully!');
console.log('Changes made:');
console.log('- parseInitData now uses decodeURIComponent() first');
console.log('- verifyTelegramHash uses _decodedPairs instead of _rawPairs');
console.log('- All rawPairs references renamed to decodedPairs');
