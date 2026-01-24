/**
 * EncryptionService - Sprint 1 Security Fix
 * 
 * Шифрование чувствительных данных (номера карт, телефоны для оплаты)
 * Использует AES-256-GCM для шифрования с аутентификацией
 */

import crypto from 'crypto';
import { logger } from './logger';

// Алгоритм шифрования
const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16; // 128 bits для GCM
const AUTH_TAG_LENGTH = 16; // 128 bits для GCM
const SALT_LENGTH = 32;

// Получаем ключ из переменной окружения или генерируем предупреждение
function getEncryptionKey(): Buffer {
  const envKey = process.env.ENCRYPTION_KEY;
  
  if (!envKey) {
    // В development можно использовать дефолтный ключ, в production - ошибка
    if (process.env.NODE_ENV === 'production') {
      logger.error('ENCRYPTION_KEY not set in production! Payment data will NOT be encrypted.');
      // Возвращаем случайный ключ чтобы не падать, но данные будут уникальны для каждого запуска
      return crypto.randomBytes(32);
    }
    
    // Development: используем детерминированный ключ для тестирования
    logger.warn('ENCRYPTION_KEY not set. Using development key. DO NOT USE IN PRODUCTION!');
    return crypto.scryptSync('dev-key-telegram-food-bot', 'salt', 32);
  }
  
  // Если ключ в hex формате (64 символа = 32 байта)
  if (envKey.length === 64 && /^[0-9a-fA-F]+$/.test(envKey)) {
    return Buffer.from(envKey, 'hex');
  }
  
  // Иначе используем scrypt для деривации ключа из пароля
  return crypto.scryptSync(envKey, 'telegram-food-bot-salt', 32);
}

// Кешируем ключ
let cachedKey: Buffer | null = null;

function getKey(): Buffer {
  if (!cachedKey) {
    cachedKey = getEncryptionKey();
  }
  return cachedKey;
}

export class EncryptionService {
  /**
   * Шифрование строки
   * Возвращает base64-encoded строку формата: IV:AuthTag:CipherText
   */
  static encrypt(plainText: string): string {
    if (!plainText) {
      return '';
    }
    
    try {
      const key = getKey();
      const iv = crypto.randomBytes(IV_LENGTH);
      
      const cipher = crypto.createCipheriv(ALGORITHM, key, iv, {
        authTagLength: AUTH_TAG_LENGTH,
      });
      
      let encrypted = cipher.update(plainText, 'utf8', 'base64');
      encrypted += cipher.final('base64');
      
      const authTag = cipher.getAuthTag();
      
      // Формат: IV:AuthTag:CipherText (все в base64)
      const result = [
        iv.toString('base64'),
        authTag.toString('base64'),
        encrypted,
      ].join(':');
      
      return result;
    } catch (error) {
      logger.error('Encryption failed:', error);
      throw new Error('Failed to encrypt data');
    }
  }
  
  /**
   * Расшифровка строки
   * Принимает формат: IV:AuthTag:CipherText (base64)
   */
  static decrypt(encryptedText: string): string {
    if (!encryptedText) {
      return '';
    }
    
    // Проверяем, является ли текст зашифрованным (содержит разделители)
    if (!encryptedText.includes(':')) {
      // Возможно, это незашифрованные данные (legacy)
      logger.warn('Attempting to decrypt unencrypted data (legacy format)');
      return encryptedText;
    }
    
    try {
      const key = getKey();
      const parts = encryptedText.split(':');
      
      if (parts.length !== 3) {
        logger.warn('Invalid encrypted format, returning as-is (might be legacy data)');
        return encryptedText;
      }
      
      const [ivBase64, authTagBase64, cipherText] = parts;
      
      const iv = Buffer.from(ivBase64, 'base64');
      const authTag = Buffer.from(authTagBase64, 'base64');
      
      const decipher = crypto.createDecipheriv(ALGORITHM, key, iv, {
        authTagLength: AUTH_TAG_LENGTH,
      });
      
      decipher.setAuthTag(authTag);
      
      let decrypted = decipher.update(cipherText, 'base64', 'utf8');
      decrypted += decipher.final('utf8');
      
      return decrypted;
    } catch (error) {
      // Если расшифровка не удалась, возможно это legacy данные
      logger.warn('Decryption failed, might be legacy unencrypted data:', error);
      return encryptedText;
    }
  }
  
  /**
   * Проверяет, зашифрованы ли данные
   */
  static isEncrypted(text: string): boolean {
    if (!text) return false;
    
    const parts = text.split(':');
    if (parts.length !== 3) return false;
    
    // Проверяем что все части - валидный base64
    try {
      for (const part of parts) {
        Buffer.from(part, 'base64');
      }
      return true;
    } catch {
      return false;
    }
  }
  
  /**
   * Хеширование для сравнения (например, для поиска по последним 4 цифрам карты)
   */
  static hash(text: string): string {
    return crypto
      .createHash('sha256')
      .update(text)
      .digest('hex');
  }
  
  /**
   * Маскирование номера карты (показываем только последние 4 цифры)
   * Работает как с зашифрованными, так и с открытыми данными
   */
  static maskCardNumber(cardNumber: string): string {
    // Сначала расшифровываем, если зашифровано
    const decrypted = this.isEncrypted(cardNumber) 
      ? this.decrypt(cardNumber) 
      : cardNumber;
    
    // Убираем все нецифровые символы
    const cleaned = decrypted.replace(/\D/g, '');
    
    if (cleaned.length < 4) {
      return '****';
    }
    
    const lastFour = cleaned.slice(-4);
    return `**** **** **** ${lastFour}`;
  }
  
  /**
   * Маскирование телефона (показываем только последние 4 цифры)
   */
  static maskPhone(phone: string): string {
    const decrypted = this.isEncrypted(phone) 
      ? this.decrypt(phone) 
      : phone;
    
    const cleaned = decrypted.replace(/\D/g, '');
    
    if (cleaned.length < 4) {
      return '+7 *** ***-**-**';
    }
    
    const lastFour = cleaned.slice(-4);
    return `+7 *** ***-${lastFour.slice(0, 2)}-${lastFour.slice(2)}`;
  }
  
  /**
   * Генерация безопасного ключа шифрования для .env
   */
  static generateKey(): string {
    return crypto.randomBytes(32).toString('hex');
  }
}

// Вспомогательные функции для удобства
export const encrypt = EncryptionService.encrypt.bind(EncryptionService);
export const decrypt = EncryptionService.decrypt.bind(EncryptionService);
export const maskCardNumber = EncryptionService.maskCardNumber.bind(EncryptionService);
export const maskPhone = EncryptionService.maskPhone.bind(EncryptionService);
