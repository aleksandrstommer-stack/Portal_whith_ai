const ADMIN_LANG_KEY = "strapi-admin-language";

export default {
  config: {
    // Русский в списке языков (ядро всё равно добавляет en). Профиль → Interface language.
    locales: ["ru"],
    translations: {
      ru: {
        "global.back": "Назад",
        "global.save": "Сохранить",
        "app.utils.publish": "Опубликовать",
        "content-manager.api.id": "Идентификатор API",
        "content-manager.containers.Edit.pluginHeader.title.new": "Создать запись",
        "content-manager.containers.Edit.reset": "Восстановить",
        "content-manager.components.reset-entry": "Восстановить запись",
        "components.Blocks.modifiers.bold": "Жирный",
        "components.Blocks.modifiers.italic": "Курсив",
        "components.Blocks.modifiers.underline": "Подчеркнутый",
        "components.Wysiwyg.selectOptions.title": "Добавить заголовок",
        "components.Wysiwyg.ToggleMode.preview-mode": "Режим предпросмотра",
        "components.WysiwygBottomControls.fullscreen": "Развернуть",
        "title": "Заголовок",
        "slug": "Идентификатор",
        "body": "Содержание",
        "note": "Комментарий",
        "testKey": "Ключ теста",
        "testTitle": "Название теста",
        "vector-knowledge": "Векторная база знаний",
      },
    },
  },
  bootstrap() {
    // Сборка админки идёт без lib "dom", поэтому не используем идентификатор `window`.
    type LocalStorageLike = { getItem(key: string): string | null; setItem(key: string, value: string): void };
    const root = globalThis as unknown as { localStorage?: LocalStorageLike };
    const ls = root.localStorage;
    if (!ls) {
      return;
    }
    // Если кэш сборки админки старый — см. scripts/clean-admin-cache.cjs
    if (!ls.getItem(ADMIN_LANG_KEY)) {
      ls.setItem(ADMIN_LANG_KEY, "ru");
    }
  },
};
