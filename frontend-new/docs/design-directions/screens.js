"use strict";
const React = window.React;
const RL = window.RocketLunchUI;
const { Button, IconButton, TextField, Status, InlineNotice, DSThemeRoot } = RL;
const h = React.createElement;
function Svg({ d, size = 22 }) {
  return h(
    "svg",
    { width: size, height: size, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.8, strokeLinecap: "round", strokeLinejoin: "round" },
    ...d.split("|").map((p, i) => h("path", { key: i, d: p }))
  );
}
const IC = {
  home: "M3 10.5 12 4l9 6.5|M5 9.5V20h14V9.5|M9.5 20v-5h5v5",
  menu: "M7 3v4|M9.5 3v4|M12 3v4|M7 7h5|M9.5 7v14|M16.5 21V3c2.4 1 3.5 3.8 3.5 6.8 0 2.3-1.4 3.7-3.5 3.7",
  stats: "M4 20V10|M10 20V4|M16 20v-7|M22 20H2",
  user: "M5 20c0-3.3 3.1-6 7-6s7 2.7 7 6|M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8",
  back: "M15 5l-7 7 7 7",
  spark: "M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z"
};
function Phone({ children, nav }) {
  return h(
    "div",
    { className: "scr-phone" },
    h("div", { className: "scr-body" }, children),
    nav !== false && h(BottomNav, null)
  );
}
function BottomNav() {
  const tabs = [
    ["home", "\u0413\u043B\u0430\u0432\u043D\u0430\u044F", true],
    ["menu", "\u041C\u0435\u043D\u044E", false],
    ["stats", "\u0421\u0442\u0430\u0442\u0438\u0441\u0442\u0438\u043A\u0430", false],
    ["user", "\u041F\u0440\u043E\u0444\u0438\u043B\u044C", false]
  ];
  return h(
    "nav",
    { className: "scr-nav" },
    ...tabs.map(
      ([ic, label, on]) => h("div", { key: label, className: "scr-nav-item" + (on ? " on" : "") }, h(Svg, { d: IC[ic], size: 22 }), h("span", null, label))
    )
  );
}
function AppHeader() {
  return h(
    "header",
    { className: "scr-appbar" },
    h("div", { className: "scr-logo" }, h(Svg, { d: IC.spark, size: 16 })),
    h("div", { className: "scr-logotype" }, "Rocket Lunch")
  );
}
function ScreenHeader({ title, status }) {
  return h(
    "header",
    { className: "scr-appbar scr-detail" },
    h("span", { className: "scr-back" }, h(Svg, { d: IC.back, size: 20 })),
    h("h1", { className: "scr-title" }, title),
    status
  );
}
function Section({ label, count, children }) {
  return h(
    "section",
    { className: "scr-section" },
    h("div", { className: "scr-sechead" }, h("span", { className: "scr-seclabel" }, label), count != null && h("span", { className: "scr-seccount" }, "\xB7 " + count)),
    children
  );
}
function Avatar({ name }) {
  return h("div", { className: "scr-avatar" }, name[0]);
}
function Bar({ value }) {
  return h("div", { className: "scr-bar" }, h("div", { className: "scr-bar-fill", style: { width: value + "%" } }));
}
function HomeScreen() {
  const options = [
    ["\u0422\u043E\u043C-\u044F\u043C \u0441 \u043A\u0440\u0435\u0432\u0435\u0442\u043A\u0430\u043C\u0438", 46, true],
    ["\u041F\u0438\u0446\u0446\u0430 \xAB\u041C\u0430\u0440\u0433\u0430\u0440\u0438\u0442\u0430\xBB", 31, false],
    ["\u0428\u0430\u0443\u0440\u043C\u0430 \u043A\u043B\u0430\u0441\u0441\u0438\u0447\u0435\u0441\u043A\u0430\u044F", 23, false]
  ];
  return h(
    Phone,
    null,
    h(AppHeader, null),
    h(
      "div",
      { className: "scr-scroll" },
      h("div", { className: "scr-greeting" }, h("div", { className: "scr-caption" }, "\u041F\u044F\u0442\u043D\u0438\u0446\u0430, 18 \u0438\u044E\u043B\u044F"), h("h1", { className: "scr-h1" }, "\u0414\u043E\u0431\u0440\u044B\u0439 \u0434\u0435\u043D\u044C, \u0418\u0433\u043E\u0440\u044C")),
      h(
        Section,
        { label: "\u0413\u043E\u043B\u043E\u0441\u0443\u0435\u043C \u0437\u0430 \u043E\u0431\u0435\u0434" },
        h("div", { className: "scr-pollmeta" }, h(Status, { tone: "accent", icon: "clock" }, "\u0418\u0434\u0451\u0442 \xB7 12:41"), h("span", { className: "scr-votes tnum" }, "13 \u0433\u043E\u043B\u043E\u0441\u043E\u0432")),
        ...options.map(
          ([name, pct, mine]) => h(
            "div",
            { key: name, className: "scr-option" + (mine ? " mine" : "") },
            h("div", { className: "scr-option-top" }, h("span", { className: "scr-option-name" }, name), h("span", { className: "scr-option-pct tnum" }, pct + "%")),
            h(Bar, { value: pct })
          )
        ),
        h("div", { className: "scr-cta-inline" }, h(Button, { block: true }, "\u0413\u043E\u043B\u043E\u0441\u043E\u0432\u0430\u0442\u044C"))
      ),
      h(
        Section,
        { label: "\u0421\u0435\u0439\u0447\u0430\u0441" },
        h(
          "div",
          { className: "scr-row scr-link" },
          h("div", { className: "scr-row-main" }, h("div", { className: "scr-row-name" }, "\u041F\u044F\u0442\u0451\u0440\u043E\u0447\u043A\u0430 \u0443 \u043E\u0444\u0438\u0441\u0430"), h("div", { className: "scr-row-sub" }, "\u0418\u0433\u043E\u0440\u044C \u0432 \u043C\u0430\u0433\u0430\u0437\u0438\u043D\u0435 \xB7 2 \u0438\u0437 4")),
          h(Status, { tone: "warning", icon: "cart" }, "\u0412 \u043C\u0430\u0433\u0430\u0437\u0438\u043D\u0435")
        ),
        h(
          "div",
          { className: "scr-row scr-link" },
          h("div", { className: "scr-row-main" }, h("div", { className: "scr-row-name" }, "\u0411\u044E\u0434\u0436\u0435\u0442 \u043A\u043E\u043C\u0430\u043D\u0434\u044B"), h("div", { className: "scr-row-sub" }, "\u0412\u044B \u0434\u043E\u043B\u0436\u043D\u044B \u0437\u0430 \u0432\u0447\u0435\u0440\u0430\u0448\u043D\u0438\u0439 \u043E\u0431\u0435\u0434")),
          h("span", { className: "scr-money tnum" }, "260 \u20BD")
        )
      )
    )
  );
}
function CollectingScreen() {
  return h(
    Phone,
    { nav: false },
    h(ScreenHeader, { title: "\u041F\u044F\u0442\u0451\u0440\u043E\u0447\u043A\u0430 \u0443 \u043E\u0444\u0438\u0441\u0430", status: h(Status, { tone: "accent", icon: "clock" }, "\u0421\u0431\u043E\u0440") }),
    h(
      "div",
      { className: "scr-scroll" },
      h(
        "div",
        { className: "scr-summary" },
        h(Avatar, { name: "\u0418\u0433\u043E\u0440\u044C" }),
        h("div", { className: "scr-summary-meta" }, h("div", { className: "scr-row-name" }, "\u0418\u043D\u0438\u0446\u0438\u0430\u0442\u043E\u0440: \u0418\u0433\u043E\u0440\u044C"), h("div", { className: "scr-row-sub" }, "2 \u0443\u0447\u0430\u0441\u0442\u043D\u0438\u043A\u0430 \xB7 3 \u043F\u043E\u0437\u0438\u0446\u0438\u0438"))
      ),
      h(
        "div",
        { className: "scr-countdown" },
        h("div", { className: "scr-countdown-row" }, h("span", { className: "scr-time tnum" }, "13:59"), h("span", { className: "scr-row-sub" }, "\u0434\u043E 14:30")),
        h(Bar, { value: 62 })
      ),
      h(
        Section,
        { label: "\u041C\u043E\u0438 \u043F\u043E\u0437\u0438\u0446\u0438\u0438", count: 2 },
        h(
          "div",
          { className: "scr-row" },
          h("div", { className: "scr-row-main" }, h("div", { className: "scr-row-name" }, "\u0425\u043B\u0435\u0431 \u0431\u043E\u0440\u043E\u0434\u0438\u043D\u0441\u043A\u0438\u0439")),
          h("div", { className: "scr-row-actions" }, h(IconButton, { name: "edit", "aria-label": "\u0418\u0437\u043C\u0435\u043D\u0438\u0442\u044C" }), h(IconButton, { name: "trash", "aria-label": "\u0423\u0434\u0430\u043B\u0438\u0442\u044C" }))
        ),
        h(
          "div",
          { className: "scr-row" },
          h(
            "div",
            { className: "scr-row-main" },
            h("div", { className: "scr-row-name" }, "\u041A\u043E\u0444\u0435 Lavazza Qualit\xE0 Oro ", h("span", { className: "scr-qty tnum" }, "\xD72")),
            h("div", { className: "scr-row-sub" }, "\u0442\u0451\u043C\u043D\u0430\u044F \u043E\u0431\u0436\u0430\u0440\u043A\u0430, \u0435\u0441\u043B\u0438 \u0435\u0441\u0442\u044C")
          ),
          h("div", { className: "scr-row-actions" }, h(IconButton, { name: "edit", "aria-label": "\u0418\u0437\u043C\u0435\u043D\u0438\u0442\u044C" }), h(IconButton, { name: "trash", "aria-label": "\u0423\u0434\u0430\u043B\u0438\u0442\u044C" }))
        )
      ),
      h(
        Section,
        { label: "\u0410\u043D\u044F", count: 1 },
        h(
          "div",
          { className: "scr-row" },
          h(
            "div",
            { className: "scr-row-main" },
            h("div", { className: "scr-row-name" }, "\u041C\u043E\u043B\u043E\u043A\u043E 3.2% ", h("span", { className: "scr-qty tnum" }, "\xD72")),
            h("div", { className: "scr-row-sub" }, "\u0441\u0438\u043D\u044E\u044E \u043F\u0430\u0447\u043A\u0443")
          )
        )
      )
    ),
    h("div", { className: "scr-cta" }, h(Button, { block: true }, "\u0414\u043E\u0431\u0430\u0432\u0438\u0442\u044C \u043F\u043E\u0437\u0438\u0446\u0438\u044E"))
  );
}
function ShoppingScreen() {
  return h(
    Phone,
    { nav: false },
    h(ScreenHeader, { title: "\u041F\u044F\u0442\u0451\u0440\u043E\u0447\u043A\u0430 \u0443 \u043E\u0444\u0438\u0441\u0430", status: h(Status, { tone: "warning", icon: "cart" }, "\u0412 \u043C\u0430\u0433\u0430\u0437\u0438\u043D\u0435") }),
    h(
      "div",
      { className: "scr-scroll" },
      h(
        "div",
        { className: "scr-progress" },
        h("div", { className: "scr-countdown-row" }, h("span", { className: "scr-progress-label tnum" }, "\u041E\u0431\u0440\u0430\u0431\u043E\u0442\u0430\u043D\u043E 2 \u0438\u0437 4"), h("span", { className: "scr-row-sub tnum" }, "\u043E\u0441\u0442\u0430\u043B\u043E\u0441\u044C 2")),
        h(Bar, { value: 50 })
      ),
      h(
        Section,
        { label: "\u041E\u0441\u0442\u0430\u043B\u043E\u0441\u044C", count: 2 },
        h(
          "div",
          { className: "scr-row scr-col" },
          h(
            "div",
            { className: "scr-row-top" },
            h(
              "div",
              { className: "scr-row-main" },
              h("div", { className: "scr-row-name" }, "\u041A\u043E\u0444\u0435 Lavazza Qualit\xE0 Oro ", h("span", { className: "scr-qty tnum" }, "\xD72")),
              h("div", { className: "scr-row-sub" }, "\u0442\u0451\u043C\u043D\u0430\u044F \u043E\u0431\u0436\u0430\u0440\u043A\u0430, \u0435\u0441\u043B\u0438 \u0435\u0441\u0442\u044C")
            ),
            h("span", { className: "scr-owner" }, "\u0410\u043B\u0435\u043A\u0441\u0430\u043D\u0434\u0440\u0430 \u041A.")
          ),
          h("div", { className: "scr-item-actions" }, h(Button, { variant: "secondary" }, "\u041A\u0443\u043F\u043B\u0435\u043D\u043E"), h(Button, { variant: "secondary" }, "\u041D\u0435 \u043D\u0430\u0448\u043B\u0438"))
        ),
        h(
          "div",
          { className: "scr-row scr-col" },
          h("div", { className: "scr-row-top" }, h("div", { className: "scr-row-main" }, h("div", { className: "scr-row-name" }, "\u0425\u043B\u0435\u0431 \u0431\u043E\u0440\u043E\u0434\u0438\u043D\u0441\u043A\u0438\u0439")), h("span", { className: "scr-owner" }, "\u0418\u0433\u043E\u0440\u044C")),
          h(
            "div",
            { className: "scr-editor" },
            h(TextField, { label: "\u0426\u0435\u043D\u0430 \u0437\u0430 \u0432\u0441\u0451, \u20BD", inputMode: "decimal", defaultValue: "54", suffix: "\u20BD" }),
            h("div", { className: "scr-item-actions" }, h(Button, { variant: "secondary" }, "\u041E\u0442\u043C\u0435\u043D\u0430"), h(Button, null, "\u0421\u043E\u0445\u0440\u0430\u043D\u0438\u0442\u044C"))
          )
        )
      ),
      h(
        Section,
        { label: "\u041A\u0443\u043F\u043B\u0435\u043D\u043E", count: 1 },
        h(
          "div",
          { className: "scr-row scr-col" },
          h("div", { className: "scr-row-top" }, h("div", { className: "scr-row-main" }, h("div", { className: "scr-row-name" }, "\u041C\u043E\u043B\u043E\u043A\u043E 3.2% ", h("span", { className: "scr-qty tnum" }, "\xD72"))), h("span", { className: "scr-owner" }, "\u0410\u043D\u044F")),
          h("div", { className: "scr-statusline" }, h(Status, { tone: "success", icon: "check" }, "\u041A\u0443\u043F\u043B\u0435\u043D\u043E"), h("span", { className: "scr-money tnum" }, "112,5 \u20BD")),
          h("div", { className: "scr-item-actions" }, h(Button, { variant: "secondary" }, "\u0418\u0437\u043C\u0435\u043D\u0438\u0442\u044C \u0446\u0435\u043D\u0443"), h(Button, { variant: "ghost" }, "\u041D\u0435 \u043D\u0430\u0448\u043B\u0438"))
        )
      ),
      h(
        Section,
        { label: "\u041D\u0435 \u043D\u0430\u0448\u043B\u0438", count: 1 },
        h(
          "div",
          { className: "scr-row scr-col" },
          h("div", { className: "scr-row-top" }, h("div", { className: "scr-row-main" }, h("div", { className: "scr-row-name" }, "\u041A\u0435\u0444\u0438\u0440 1%")), h("span", { className: "scr-owner" }, "\u0410\u043D\u044F")),
          h("div", { className: "scr-statusline" }, h(Status, { tone: "danger" }, "\u041D\u0435 \u043D\u0430\u0448\u043B\u0438")),
          h("div", { className: "scr-item-actions" }, h(Button, { variant: "secondary" }, "\u0412\u0441\u0451-\u0442\u0430\u043A\u0438 \u043A\u0443\u043F\u043B\u0435\u043D\u043E"))
        )
      ),
      h(InlineNotice, { tone: "info" }, "\u0417\u0430\u0432\u0435\u0440\u0448\u0438\u0442\u0435 \u0440\u0430\u0441\u0447\u0451\u0442 \u043F\u043E\u0441\u043B\u0435 \u043F\u043E\u043A\u0443\u043F\u043A\u0438. \u041D\u0435\u0437\u0430\u0432\u0435\u0440\u0448\u0451\u043D\u043D\u0430\u044F \u0437\u0430\u043A\u0443\u043F\u043A\u0430 \u043C\u043E\u0436\u0435\u0442 \u0431\u044B\u0442\u044C \u043E\u0442\u043C\u0435\u043D\u0435\u043D\u0430 \u0430\u0432\u0442\u043E\u043C\u0430\u0442\u0438\u0447\u0435\u0441\u043A\u0438.")
    ),
    // активна мутация строки (открыт редактор цены) → settle заблокирован; primary в редакторе
    h("div", { className: "scr-cta" }, h(Button, { block: true, disabled: true }, "\u0420\u0430\u0441\u0441\u0447\u0438\u0442\u0430\u0442\u044C"))
  );
}
const params = new URLSearchParams(location.search);
const screen = params.get("screen") || "home";
const theme = params.get("theme") || "light";
const SCREENS = { home: HomeScreen, collecting: CollectingScreen, shopping: ShoppingScreen };
const Root = SCREENS[screen] || HomeScreen;
window.ReactDOM.createRoot(document.getElementById("root")).render(
  h(DSThemeRoot, { theme }, h(Root, null))
);
