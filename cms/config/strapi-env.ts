/**
 * Тип функции `env` в конфигах Strapi (обёртка над переменными окружения).
 */
export type StrapiConfigEnv = {
  (key: string, defaultValue?: string): string;
  int(key: string, defaultValue?: number): number;
  bool(key: string, defaultValue?: boolean): boolean;
  array(key: string, defaultValue?: string[]): string[];
};
