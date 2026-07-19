import { expect, test } from "@playwright/test";
import type { Page } from "@playwright/test";

const installTelegramMock = async (page: Page) => {
  await page.addInitScript(() => {
    const noOp = () => undefined;
    window.Telegram = {
      WebApp: {
        initData: "",
        initDataUnsafe: {
          user: {
            id: 1001,
            first_name: "Тестовый пользователь",
            username: "e2e_user",
          },
        },
        colorScheme: "light",
        themeParams: {},
        ready: noOp,
        expand: noOp,
        close: noOp,
        BackButton: { show: noOp, hide: noOp, onClick: noOp, offClick: noOp },
        MainButton: {
          show: noOp,
          hide: noOp,
          enable: noOp,
          disable: noOp,
          setText: noOp,
          onClick: noOp,
          offClick: noOp,
        },
        HapticFeedback: {
          impactOccurred: noOp,
          notificationOccurred: noOp,
          selectionChanged: noOp,
        },
      },
    };
  });
};

test.describe("Критический путь Mini App", () => {
  test.beforeEach(async ({ page }) => {
    await installTelegramMock(page);
  });

  test("главная страница запускается без необработанной ошибки", async ({
    page,
  }) => {
    const pageErrors: Error[] = [];
    page.on("pageerror", (error) => pageErrors.push(error));

    await page.goto("/");
    await expect(page.locator("body")).toBeVisible();
    await expect(page.locator("#root")).not.toBeEmpty();
    expect(pageErrors).toEqual([]);
  });

  test("основные маршруты не приводят к пустому экрану", async ({ page }) => {
    for (const route of ["/", "/menu", "/stats", "/profile"]) {
      await page.goto(route);
      await expect(page.locator("#root")).not.toBeEmpty();
    }
  });
});
