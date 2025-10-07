# План проекта: Telegram Food Bot

Этот документ описывает полный план разработки для Telegram Food Bot, включая настройку, backend, frontend, тестирование и деплой.

## @devops_engineer (Отвечает за инфраструктуру, CI/CD и деплой)

### Goal: Настройка и развертывание инфраструктуры проекта

- [ ] **Задача 0.1: Настройка окружения разработки** (priority: critical, time: 1 day) {#setup-env}
  - [ ] Установить Node.js 18+, PostgreSQL 14+, Git
  - [ ] Настроить VS Code с рекомендованными расширениями
  - [ ] Создать Telegram бота через @BotFather и получить токен
  - [ ] Настроить тестовую группу в Telegram
- [ ] **Задача 0.2: Инициализация проектов** (priority: critical, time: 1 day) depends on: #setup-env {#init-projects}
  - [ ] Создать корневую директорию проекта и Git репозиторий
  - [ ] Инициализировать backend проект (TypeScript, grammy, express, prisma)
  - [ ] Инициализировать frontend проект через Vite (React-TS, Tailwind CSS, TWA SDK)
  - [ ] Настроить ESLint, Prettier, и .gitignore для обоих проектов
- [ ] **Задача 0.3: Настройка Docker и БД** (priority: high, time: 1 day) depends on: #init-projects {#setup-docker-db}
  - [ ] Создать `docker-compose.yml` с сервисом PostgreSQL
  - [ ] Настроить volume для персистентности данных БД
  - [ ] Создать `.env.example` с переменными окружения
  - [ ] Запустить PostgreSQL и проверить подключение
- [ ] **Задача 6.1: Подготовка к production** (priority: critical, time: 2 days) {#prep-prod}
  - [ ] Создать production-ready Dockerfiles (multi-stage builds)
  - [ ] Создать `docker-compose.prod.yml`
  - [ ] Настроить nginx для reverse proxy и раздачи статики
  - [ ] Настроить безопасное управление переменными окружения
- [ ] **Задача 6.2: Деплой на сервер** (priority: critical, time: 1 day) depends on: #prep-prod {#deploy}
  - [ ] Настроить VPS (Ubuntu, Docker, Nginx, Certbot)
  - [ ] Настроить домен и получить SSL сертификат
  - [ ] Развернуть приложение через `docker-compose`
  - [ ] Настроить Telegram Webhook
- [ ] **Задача 6.3: Настройка мониторинга и бэкапов** (priority: high, time: 1 day) depends on: #deploy {#monitoring}
  - [ ] Настроить healthcheck эндпоинты
  - [ ] Настроить автоматические бэкапы базы данных
  - [ ] Настроить сервис для мониторинга доступности (e.g., UptimeRobot)

## @backend_developer (Отвечает за серверную логику, API и базу данных)

### Goal: Разработка базовой инфраструктуры бэкенда

- [ ] **Задача 0.4: Инициализация Prisma и схемы БД** (priority: critical, time: 1 day) depends on: #setup-docker-db {#prisma-init}
  - [ ] Инициализировать Prisma в backend проекте
  - [ ] Создать базовую схему БД (`User`, `Group`, `MenuItem`, `Poll`, `Vote`, `PollResult`)
  - [ ] Создать и применить первую миграцию
  - [ ] Сгенерировать Prisma Client
- [ ] **Задача 1.3: Разработка сервисов для работы с БД** (priority: critical, time: 2 days) depends on: #prisma-init {#db-services}
  - [ ] Создать Prisma Client singleton
  - [ ] Реализовать `user.service.ts`
  - [ ] Реализовать `group.service.ts`
  - [ ] Реализовать CRUD операции в `menu.service.ts`
- [ ] **Задача 1.1: Настройка базовой логики бота** (priority: critical, time: 2 days) depends on: #db-services {#bot-base}
  - [ ] Инициализировать Grammy бота
  - [ ] Реализовать команду `/start` (сохранение пользователя)
  - [ ] Реализовать команду `/help`
  - [ ] Настроить запуск с hot-reload для разработки
- [ ] **Задача 1.2: Реализация Middleware и утилит** (priority: high, time: 2 days) depends on: #bot-base {#bot-middleware}
  - [ ] Настроить логгер Winston
  - [ ] Создать middleware для логирования, аутентификации и проверки прав админа
  - [ ] Создать кастомные классы ошибок и файл с константами
- [ ] **Задача 1.4: Разработка REST API для Mini App** (priority: critical, time: 2 days) depends on: #db-services {#api-base}
  - [ ] Настроить Express сервер
  - [ ] Реализовать middleware для валидации `initData` от Telegram
  - [ ] Создать `auth.routes.ts` для валидации
  - [ ] Создать `menu.routes.ts` (CRUD, toggle) с контроллерами

### Goal: Разработка системы голосования и рулетки

- [ ] **Задача 3.1: Разработка сервисов для голосования** (priority: critical, time: 3 days) depends on: #db-services {#poll-services}
  - [ ] Обновить схему Prisma для голосований
  - [ ] Реализовать `poll.service.ts` (создание, закрытие, получение результатов)
  - [ ] Реализовать `vote.service.ts` (добавление, обновление, подсчет голосов)
- [ ] **Задача 3.2: Разработка API эндпоинтов для голосований** (priority: critical, time: 2 days) depends on: #poll-services {#poll-api}
  - [ ] Создать `poll.routes.ts` (получение активного голосования, результатов, истории)
  - [ ] Реализовать контроллеры
  - [ ] (Опционально) Настроить WebSocket для real-time обновлений
- [ ] **Задача 3.3: Реализация команды `/startpoll`** (priority: critical, time: 3 days) depends on: #poll-services {#startpoll-command}
  - [ ] Создать обработчик команды с проверкой прав админа
  - [ ] Сгенерировать и отправить сообщение с inline-клавиатурой (список блюд)
  - [ ] Реализовать таймер для автоматического завершения голосования
- [ ] **Задача 3.4: Обработка голосов (callback queries)** (priority: critical, time: 2 days) depends on: #startpoll-command {#handle-votes}
  - [ ] Создать обработчик callback-запросов для регистрации и изменения голосов
  - [ ] Отправлять `callback answers` для обратной связи
  - [ ] Обновлять сообщение с голосованием, отображая текущее количество голосов
- [ ] **Задача 3.5: Реализация завершения голосования** (priority: critical, time: 2 days) depends on: #handle-votes {#end-poll}
  - [ ] Создать логику для закрытия голосования (вручную админом или по таймеру)
  - [ ] Подсчитать результаты и определить победителя
  - [ ] Отредактировать сообщение с результатами
- [ ] **Задача 4.1: Разработка сервиса рулетки** (priority: critical, time: 2 days) depends on: #poll-services {#roulette-service}
  - [ ] Обновить схему Prisma для сохранения результатов рулетки
  - [ ] Реализовать `roulette.service.ts` (выбор случайного пользователя из проголосовавших)
- [ ] **Задача 4.2: Реализация логики запуска рулетки** (priority: critical, time: 2 days) depends on: #roulette-service, #end-poll {#run-roulette}
  - [ ] Интегрировать автоматический запуск рулетки после завершения голосования
  - [ ] Реализовать текстовую "анимацию" выбора
  - [ ] Отправить финальное сообщение с упоминанием ответственного
- [ ] **Задача 4.3: Разработка системы уведомлений** (priority: medium, time: 2 days) depends on: #run-roulette {#notifications}
  - [ ] Создать `notification.service.ts`
  - [ ] Реализовать отправку личного сообщения ответственному с деталями заказа

## @frontend_developer (Отвечает за разработку Mini App)

### Goal: Разработка Mini App для управления меню

- [ ] **Задача 2.1: Базовая настройка React приложения** (priority: critical, time: 2 days) depends on: #init-projects {#frontend-setup}
  - [ ] Настроить Tailwind CSS
  - [ ] Интегрировать Telegram WebApp SDK и создать хук `useTelegram`
  - [ ] Создать базовый Layout и общие компоненты (Button, Input, Loader, Toast)
- [ ] **Задача 2.2: Настройка API клиента и авторизации** (priority: critical, time: 2 days) depends on: #frontend-setup, #api-base {#frontend-api-auth}
  - [ ] Настроить базовый API клиент (axios) с interceptor'ами
  - [ ] Реализовать `auth.service.ts` для валидации `initData`
  - [ ] Создать хук `useAuth` и state manager для хранения состояния пользователя
- [ ] **Задача 2.3: Реализация списка блюд меню** (priority: critical, time: 2 days) depends on: #frontend-api-auth {#menu-list}
  - [ ] Создать `menu.service.ts` для взаимодействия с API меню
  - [ ] Создать хук `useMenu` для управления состоянием меню
  - [ ] Разработать компоненты `MenuItem` (карточка) и `MenuList` (список)
  - [ ] Создать главную страницу `MenuPage.tsx`
- [ ] **Задача 2.4: Создание формы добавления/редактирования блюда** (priority: critical, time: 2 days) depends on: #menu-list {#menu-form}
  - [ ] Разработать компонент формы `MenuForm.tsx` с валидацией
  - [ ] Интегрировать логику создания и редактирования блюд
  - [ ] Использовать Telegram MainButton для отправки формы
- [ ] **Задача 2.5: Реализация удаления и управления блюдами** (priority: high, time: 1 day) depends on: #menu-list {#menu-manage}
  - [ ] Создать модальное окно для подтверждения удаления
  - [ ] Реализовать переключатель для активации/деактивации блюда
  - [ ] Разработать компонент `MenuFilter.tsx` для поиска и фильтрации
- [ ] **Задача 2.6: Внедрение уведомлений и улучшение UX** (priority: medium, time: 1 day) depends on: #menu-form {#frontend-ux}
  - [ ] Интегрировать Toast-уведомления для всех CRUD операций
  - [ ] Добавить скелетоны для состояний загрузки
  - [ ] Адаптировать интерфейс под светлую/темную тему Telegram

### Goal: Реализация интерфейса для просмотра статистики

- [ ] **Задача 4.4: Просмотр истории голосований и статистики** (priority: medium, time: 2 days) depends on: #poll-api {#stats-page}
  - [ ] Создать эндпоинты для получения статистики на бэкенде
  - [ ] Разработать компонент `PollHistory.tsx` для отображения истории
  - [ ] Разработать компонент `PopularDishes.tsx` для отображения популярных блюд
  - [ ] Создать страницу `StatsPage.tsx` и добавить навигацию

## @project_manager (Отвечает за документацию и контроль качества)

### Goal: Подготовка документации и обеспечение качества

- [ ] **Задача 0.5: Настройка проектной документации** (priority: medium, time: 1 day) {#setup-docs}
  - [ ] Создать главный `README.md`
  - [ ] Создать `docs/SETUP.md`, `docs/ARCHITECTURE.md` и шаблон для `docs/API.md`
- [ ] **Задача 5.1: Unit тестирование** (priority: high, time: 2 days) depends on: #db-services, #roulette-service {#unit-tests}
  - [ ] Настроить Jest для backend и frontend
  - [ ] Написать тесты для всех сервисов бэкенда и ключевых утилит
  - [ ] Достичь покрытия > 70% для критических модулей
- [ ] **Задача 5.2: Integration тестирование** (priority: high, time: 2 days) depends on: #api-base, #poll-api {#integration-tests}
  - [ ] Настроить supertest для тестирования API эндпоинтов
  - [ ] Настроить тестовую базу данных
  - [ ] Настроить CI pipeline (GitHub Actions) для автоматического запуска тестов и линтеров
- [ ] **Задача 5.3: E2E тестирование (опционально)** (priority: low, time: 2 days) depends on: #menu-form {#e2e-tests}
  - [ ] Настроить Playwright или Cypress
  - [ ] Написать E2E тесты для основного функционала Mini App
- [ ] **Задача 5.5: Обработка ошибок и граничных случаев** (priority: high, time: 2 days) {#error-handling}
  - [ ] Улучшить обработку ошибок в боте и API
  - [ ] Протестировать граничные случаи (пустое меню, голосование без участников и т.д.)
- [ ] **Задача 6.4: Финальная документация** (priority: high, time: 2 days) depends on: #deploy {#final-docs}
  - [ ] Завершить все документы в папке `docs/` (`API.md`, `DEPLOYMENT.md`, `USER_GUIDE.md`)
  - [ ] Обновить главный `README.md` скриншотами и гифками
  - [ ] Создать `CHANGELOG.md`