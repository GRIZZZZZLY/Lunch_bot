/**
 * Утилиты для работы с датами используя date-fns
 * Централизованное место для всех операций с датами в проекте
 */

import {
  format,
  startOfDay,
  endOfDay,
  addMinutes,
  addHours,
  addDays,
  subMinutes,
  subHours,
  subDays,
  isAfter,
  isBefore,
  isEqual,
  differenceInMinutes,
  differenceInHours,
  differenceInDays,
  differenceInMilliseconds,
  parseISO,
} from 'date-fns';
import { ru } from 'date-fns/locale';

/**
 * Получить текущую дату/время
 */
export const now = (): Date => new Date();

/**
 * Получить начало дня для даты (00:00:00.000)
 */
export const getStartOfDay = (date?: Date): Date => {
  return startOfDay(date || now());
};

/**
 * Получить конец дня для даты (23:59:59.999)
 */
export const getEndOfDay = (date?: Date): Date => {
  return endOfDay(date || now());
};

/**
 * Получить начало сегодняшнего дня
 */
export const getStartOfToday = (): Date => {
  return startOfDay(now());
};

/**
 * Добавить минуты к дате
 */
export const addMinutesToDate = (date: Date, minutes: number): Date => {
  return addMinutes(date, minutes);
};

/**
 * Добавить часы к дате
 */
export const addHoursToDate = (date: Date, hours: number): Date => {
  return addHours(date, hours);
};

/**
 * Добавить дни к дате
 */
export const addDaysToDate = (date: Date, days: number): Date => {
  return addDays(date, days);
};

/**
 * Вычесть минуты из даты
 */
export const subtractMinutes = (date: Date, minutes: number): Date => {
  return subMinutes(date, minutes);
};

/**
 * Вычесть часы из даты
 */
export const subtractHours = (date: Date, hours: number): Date => {
  return subHours(date, hours);
};

/**
 * Вычесть дни из даты
 */
export const subtractDays = (date: Date, days: number): Date => {
  return subDays(date, days);
};

/**
 * Проверить что date1 после date2
 */
export const isDateAfter = (date1: Date, date2: Date): boolean => {
  return isAfter(date1, date2);
};

/**
 * Проверить что date1 до date2
 */
export const isDateBefore = (date1: Date, date2: Date): boolean => {
  return isBefore(date1, date2);
};

/**
 * Проверить что даты равны
 */
export const areDatesEqual = (date1: Date, date2: Date): boolean => {
  return isEqual(date1, date2);
};

/**
 * Получить разницу в минутах между датами
 */
export const getMinutesDifference = (date1: Date, date2: Date): number => {
  return differenceInMinutes(date1, date2);
};

/**
 * Получить разницу в часах между датами
 */
export const getHoursDifference = (date1: Date, date2: Date): number => {
  return differenceInHours(date1, date2);
};

/**
 * Получить разницу в днях между датами
 */
export const getDaysDifference = (date1: Date, date2: Date): number => {
  return differenceInDays(date1, date2);
};

/**
 * Получить разницу в миллисекундах между датами
 */
export const getMillisecondsDifference = (date1: Date, date2: Date): number => {
  return differenceInMilliseconds(date1, date2);
};

/**
 * Форматировать дату в ISO строку
 */
export const toISOString = (date: Date): string => {
  return date.toISOString();
};

/**
 * Форматировать дату в локальную строку (русская локаль)
 */
export const toLocaleDateString = (date: Date): string => {
  return format(date, 'dd.MM.yyyy', { locale: ru });
};

/**
 * Форматировать дату и время (русская локаль)
 */
export const toLocaleDateTimeString = (date: Date): string => {
  return format(date, 'dd.MM.yyyy HH:mm', { locale: ru });
};

/**
 * Форматировать время
 */
export const toTimeString = (date: Date): string => {
  return format(date, 'HH:mm', { locale: ru });
};

/**
 * Форматировать дату с пользовательским форматом
 */
export const formatDate = (date: Date, formatString: string): string => {
  return format(date, formatString, { locale: ru });
};

/**
 * Парсить ISO строку в Date
 */
export const parseISOString = (isoString: string): Date => {
  return parseISO(isoString);
};

/**
 * Получить timestamp (миллисекунды с эпохи Unix)
 */
export const getTimestamp = (date: Date): number => {
  return date.getTime();
};

/**
 * Создать дату из timestamp
 */
export const fromTimestamp = (timestamp: number): Date => {
  return new Date(timestamp);
};

/**
 * Вычислить время окончания голосования
 * @param startDate - дата начала
 * @param durationMinutes - длительность в минутах
 */
export const calculatePollEndTime = (
  startDate: Date,
  durationMinutes: number
): Date => {
  return addMinutes(startDate, durationMinutes);
};

/**
 * Проверить истек ли poll
 */
export const isPollExpired = (endTime: Date): boolean => {
  return isBefore(endTime, now());
};

/**
 * Получить прогресс времени (0-1)
 */
export const getTimeProgress = (startTime: Date, endTime: Date): number => {
  const nowTime = now();
  const elapsed = getMillisecondsDifference(nowTime, startTime);
  const total = getMillisecondsDifference(endTime, startTime);
  return elapsed / total;
};
