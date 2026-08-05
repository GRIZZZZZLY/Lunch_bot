import fs from 'fs';
import path from 'path';
import express from 'express';
import { createApiServer } from '../../../api/server';

/* createApiServer отказывается стартовать без каталога сборки фронтенда. В бою
   это правильно — процесс, отдающий статику, без неё бесполезен, — но джоб
   «Backend quality» фронтенд не собирает, и там этого каталога нет. Локально он
   обычно лежит на диске, поэтому набор проходил на машине и падал в CI.

   Делаем настоящий каталог dist с настоящим index.html: тогда и express.static,
   и sendFile работают без подмены файловой системы. Каталог создаём внутри
   backend/, а не в системном temp: на Windows temp часто на другом диске,
   path.relative между дисками возвращает абсолютный путь, и сервер склеит его
   с корнем проекта в мусор. */
let frontendDir: string | undefined;

function ensureFrontendDist(): void {
  if (frontendDir) return;
  frontendDir = fs.mkdtempSync(path.join(process.cwd(), 'tmp-frontend-'));
  fs.mkdirSync(path.join(frontendDir, 'dist'));
  fs.writeFileSync(
    path.join(frontendDir, 'dist', 'index.html'),
    '<!doctype html>ok'
  );
  /* Сервер собирает путь как path.join(projectRoot, FRONTEND_DIR, 'dist'),
     поэтому передаём путь ОТНОСИТЕЛЬНО корня проекта. */
  process.env.FRONTEND_DIR = path.relative(
    path.resolve(process.cwd(), '..'),
    frontendDir
  );
}

/* Хук объявлен на уровне модуля, а не внутри ensureFrontendDist: jest запрещает
   регистрировать хуки из тела теста, и такой вызов упал бы у первого же набора,
   который создаёт приложение не на этапе сбора. */
afterAll(() => {
  if (!frontendDir) return;
  fs.rmSync(frontendDir, { recursive: true, force: true });
  frontendDir = undefined;
});

/**
 * Создаёт Express app для тестирования
 * Отключает лишние middleware (логирование, статику)
 */
export function createTestApp(): express.Application {
  ensureFrontendDist();
  const app = createApiServer();
  return app;
}
