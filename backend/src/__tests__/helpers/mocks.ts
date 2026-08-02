/**
 * Типизация замоканных сервисов.
 *
 * `X as jest.Mocked<typeof X>` заставляет каждый `mockResolvedValue` принимать
 * полный тип возвращаемого значения — для Prisma-моделей это 15 полей ради
 * проверки одного. Обходной путь `as never` в каждом вызове eslint удаляет как
 * «ненужное приведение» (он видит тесты через другой tsconfig), и тесты
 * перестают компилироваться.
 *
 * Здесь приведение делается ОДИН раз на сервис: методы становятся jest.Mock,
 * фикстуры пишутся частичными, а проверки `toHaveBeenCalledWith` работают
 * как обычно.
 */
export type ServiceMock<T> = { [K in keyof T]: jest.Mock };

export function asServiceMock<T>(service: T): ServiceMock<T> {
  return service as unknown as ServiceMock<T>;
}

/** То же для отдельной замоканной функции. */
export function asMock<T>(fn: T): jest.Mock {
  return fn as unknown as jest.Mock;
}
