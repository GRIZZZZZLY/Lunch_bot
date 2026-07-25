# Матрица сквозного покрытия `frontend-new`

Последнее обновление: 2026-07-20. Источник функций — фактические маршруты `src/App.tsx`, интерактивные элементы компонентов, документация `frontend-new/docs/` и истории `docs/user-stories/feature-status.csv`. Каждый тест формулируется как: роль → состояние → действие → запрос/Telegram-вызов → интерфейс.

Статусы: **покрыто** — есть явный Playwright-сценарий; **интеграция** — проверяется дополнительно с настоящим Express/PostgreSQL; **не применимо** — функции нет в `frontend-new`.

## Маршруты и действия

| Маршрут | Функция / действие | Роль | Состояние | Тест | Проверка | Статус |
|---|---|---|---|---|---|---|
| `/` | Вход и нижняя навигация | MEMBER | одна группа, пустой день | `routes-auth.spec.ts` | подписанный макет `initData`, четыре перехода, BackButton | покрыто |
| `/` | Голосование | MEMBER, не голосовал | ACTIVE | `home-polls.spec.ts` | выбор, `POST /polls/:id/vote`, «Голос учтён» | покрыто, RL-US-034/035 |
| `/` | Переголосование и отзыв | MEMBER, голосовал | ACTIVE | `home-polls.spec.ts` | новое тело голоса, `DELETE`, состояние карточки | покрыто, RL-US-037 |
| `/` | Завершение / отмена опроса | ADMIN | ACTIVE | `home-polls.spec.ts` | `PATCH complete/cancel`, уведомление, отсутствие MEMBER-кнопок | покрыто, RL-US-038/039 |
| `/` | Создание разового опроса | ADMIN | меню заполнено | `home-polls.spec.ts` | минимум 2 блюда, тело запроса, появление, закрытие, результаты | покрыто, критический путь |
| `/` | Расписание | ADMIN | меню заполнено | `home-polls.spec.ts` | переключатель, дни/время/блюда, `POST /recurring` | покрыто, RL-US-029 |
| `/` | Создание закупки | MEMBER → инициатор | нет активной закупки | `store-run.spec.ts` | валидация, длительность, POST, переход на `/store-run/602` | покрыто, RL-US-064 |
| `/` | Пусто / 500 / повтор | MEMBER | пусто, ошибка | `home-polls.spec.ts` | понятный экран и восстановление | покрыто |
| `/` | Нет групп | ADMIN | `groups=[]` | `home-polls.spec.ts`, `routes-auth.spec.ts` | нет административного запуска, нет пустого экрана | покрыто |
| `/menu` | Просмотр, поиск, категории | MEMBER | заполнено / нет результатов | `menu.spec.ts` | фильтр и отсутствие управления | покрыто |
| `/menu` | Добавить / изменить / скрыть / удалить | ADMIN | заполнено | `menu.spec.ts` | методы, адреса, тела, UI, подтверждение и отмена | покрыто, критический путь |
| `/menu` | Валидация / ошибка сохранения | ADMIN | 500 | `menu.spec.ts` | блокировка, одна отправка, сохранённые поля, сообщение | покрыто |
| `/menu` | Пусто / ошибка / повтор | MEMBER | пусто, 500 | `menu.spec.ts` | роль-зависимый текст и восстановление | покрыто |
| `/menu` | Настоящий договор API | CREATOR | seeded PostgreSQL | `integration.spec.ts` | настоящий вход, группы и два блюда | интеграция |
| `/stats` | Участие, команда, блюда, недели | MEMBER | история есть | `profile-stats-admin.spec.ts` | реальные клиентские вычисления | покрыто, RL-US-088/089 по возможностям нового экрана |
| `/stats` | Пусто / ошибка истории | MEMBER | пустой ответ, 500 | `profile-stats-admin.spec.ts` | безопасный пустой экран без падения | покрыто |
| `/profile` | Данные и реквизиты | MEMBER | заполнено | `profile-stats-admin.spec.ts` | PUT, тело и обновлённый экран | покрыто, RL-US-084/085 |
| `/profile` | Тема | MEMBER | light → dark | `profile-stats-admin.spec.ts`, `routes-auth.spec.ts` | ручной выбор, localStorage, Telegram `themeChanged` | покрыто |
| `/profile` | История / предложения / статистика | MEMBER | обычное | `profile-stats-admin.spec.ts` | все переходы | покрыто |
| `/profile` | Отзыв / поддержка | MEMBER | заполнено | `profile-stats-admin.spec.ts` | rating+body; перехваченный `window.open`, без платежа | покрыто |
| `/profile` | Административная точка | CREATOR, ADMIN, globalAdmin, MEMBER | разные права | `profile-stats-admin.spec.ts` | видимость по группе; отсутствие у MEMBER | покрыто |
| `/admin` | Прямая защита | MEMBER | прямой URL | `profile-stats-admin.spec.ts`, `routes-auth.spec.ts` | нет управляющих действий | покрыто |
| `/admin` | Обзор / люди / долги / очистка / настройки | globalAdmin, ADMIN, CREATOR | заполнено | `profile-stats-admin.spec.ts` | вкладки, загрузка, switch и PUT настроек | покрыто, RL-US-093–097 |
| `/budget` | Пусто | MEMBER | нет транзакций | `budget-suggestions.spec.ts` | нет ложных кнопок | покрыто |
| `/budget` | Оплатил / отменил отметку | должник | PENDING / PAID | `budget-suggestions.spec.ts` | правильный transactionId, UI и 403 | покрыто, RL-US-073/075 |
| `/budget` | Подтверждение / напоминание | ответственный | PAID / PENDING | `budget-suggestions.spec.ts` | POST, завершение, уведомление | покрыто, RL-US-076/078 |
| `/suggestions` | Создание / валидация | MEMBER | список есть | `budget-suggestions.spec.ts` | невалидная цена, POST body, появление | покрыто |
| `/suggestions` | Все / мои / статусы / удаление | MEMBER | PENDING/APPROVED/REJECTED | `budget-suggestions.spec.ts` | фильтр и ConfirmDialog | покрыто |
| `/suggestions` | Принять / отклонить | ADMIN | два PENDING | `budget-suggestions.spec.ts` | groupId, причина, новый статус | покрыто |
| `/suggestions` | Ошибка / повтор | MEMBER | 500 | `budget-suggestions.spec.ts` | ErrorState и refetch | покрыто |
| `/suggestions/mine` | Свои предложения | MEMBER | пусто / заполнено | `routes-auth.spec.ts`, `profile-stats-admin.spec.ts` | прямой URL и профильный переход | покрыто |
| `/poll/history` | История | MEMBER | одна запись | `routes-auth.spec.ts`, `profile-stats-admin.spec.ts` | прямой URL и Telegram BackButton | покрыто |
| `/poll/:id/results` | Итоги / deep link | MEMBER | завершён / создан и закрыт | `home-polls.spec.ts`, `routes-auth.spec.ts` | победитель, переход по query и прямой URL | покрыто |
| `/store-run/:id` | COLLECTING | участник | REQUESTED | `store-run.spec.ts` | add/edit/delete только своих; чужие read-only | покрыто, RL-US-065/066 |
| `/store-run/:id` | Закрыть / отменить сбор | инициатор | COLLECTING / empty | `store-run.spec.ts` | подтверждения, блокировка пустого, POST | покрыто, RL-US-067/071 |
| `/store-run/:id` | SHOPPING | инициатор | REQUESTED/BOUGHT/NOT_FOUND | `store-run.spec.ts` | цена 0, ×quantity, смена статуса, запрет без цены | покрыто, RL-US-068/069 |
| `/store-run/:id` | Расчёт | инициатор | есть необработанные | `store-run.spec.ts` | подтверждение, POST settle, SETTLED | покрыто, RL-US-070 |
| `/store-run/:id` | SHOPPING read-only | участник | покупки идут | `store-run.spec.ts` | личная сумма, отсутствие мутаций | покрыто |
| `/store-run/:id` | SETTLED / CANCELLED | обе роли | терминальные | `store-run.spec.ts` | read-only, причина, итог, возврат домой | покрыто |
| `/store-run/:id` | 403 / 404 / 500 / retry / invalid id | MEMBER | ошибки | `store-run.spec.ts` | разные экраны и допустимость повторения | покрыто |
| `*` | Неизвестный маршрут | MEMBER | 404 | `routes-auth.spec.ts` | экран и возврат | покрыто |
| `/dev/ui` | Витрина компонентов | разработчик | только `import.meta.env.DEV` | — | отсутствует в production build, не пользовательский маршрут | не применимо |

## Сквозные гарантии

| Область | Тест / механизм | Что гарантируется |
|---|---|---|
| Telegram WebApp | `mocks/telegram.ts` | установка до приложения; пользователь/initData; темы/события/safe-area; журнал `ready`, `expand`, `close`, BackButton, MainButton, HapticFeedback, links, invoice, alert/confirm |
| API | `mocks/api.ts` | отдельное mutable-состояние на тест; неожиданный маршрут = 501 и падение теста; методы/пути/query/body записываются |
| Изоляция | новый BrowserContext + `createScenario` на тест; Service Worker заблокирован | local/session/IndexedDB и React Query не разделяются между тестами; SSE подменён; порядок тестов не важен |
| Время | `page.clock` = `2026-07-20T09:05:00Z` | таймеры опроса и закупки воспроизводимы |
| Ошибки | автоматическая fixture `diagnostics` | `pageerror`, значимый `console.error`, оборванная сеть и непредусмотренный API завершают тест ошибкой |
| Доступность | `routes-auth.spec.ts` + `@axe-core/playwright` | serious/critical WCAG, доступные имена, контраст ключевого экрана |
| Компоновка | `routes-auth.spec.ts` | нет горизонтальной прокрутки при 390×844 |
| Браузеры | `playwright.config.ts` | 390×844 Chromium (основной), 390×844 WebKit, быстрый desktop Chromium |
| Настоящий сервер | `integration.spec.ts`, `backend/src/scripts/e2e-seed.ts` | readiness, 401-договор, подписанный initData, Express↔PostgreSQL↔UI; seed отказывается работать с БД без `test/e2e` в имени |
| Продакшен | `tests/production/production-smoke.spec.ts` | readiness, вход отдельного MEMBER, корневые и пользовательские экраны, доступность; любые изменяющие запросы блокируются до отправки |

## Осознанные границы фактического интерфейса

- Выход из аккаунта, прощение долга в пользовательском `/budget`, фильтры статистики, Telegram MainButton и `openInvoice` сейчас не имеют видимых пользовательских действий в `frontend-new`; макет Telegram поддерживает их, но придумывать несуществующие кнопки тесты не должны.
- Категорийные заказы и расширенная статистика из историй старого `frontend/` не входят в целевой каталог.
- У нового экрана статистики ошибка истории нормализуется в пустой набор — это зафиксировано тестом как текущее поведение; отдельной кнопки «Повторить» компонент не предоставляет.
- Полное совпадение изображений не используется: смысловые проверки устойчивее текущей активно меняющейся верстки. Снимки, видео и трассировки сохраняются при сбоях.

## Запуск

Из каталога `frontend-new`:

```bash
npm run test:e2e          # основной мобильный Chromium
npm run test:e2e:smoke    # короткий набор критических путей
npm run test:e2e:full     # мобильные Chromium/WebKit и настольный Chromium
npm run test:e2e:ui       # интерактивный режим Playwright
npm run test:e2e:report   # последний HTML-отчёт
npm run test:e2e:production # безопасный боевой набор; требует переменных окружения
```

Интеграционный набор запускается командой `npm run test:e2e:integration` при
`E2E_INTEGRATION=1`, с работающим сервером и отдельной PostgreSQL. Перед ним из
`backend` выполняется `npm run e2e:seed`, после — `npm run e2e:cleanup`. Скрипт
заполнения намеренно откажется работать, если имя базы не содержит `test` или
`e2e`; готовый безопасный порядок запуска закреплён в GitHub Actions.
