import type { StrapiConfigEnv } from "./strapi-env";

export default ({ env }: { env: StrapiConfigEnv }) => ({
  connection: {
    client: "postgres",
    connection: {
      host: env("DATABASE_HOST", "127.0.0.1"),
      port: env.int("DATABASE_PORT", 5432),
      database: env("DATABASE_NAME", "strapi"),
      user: env("DATABASE_USERNAME", "strapi"),
      password: env("DATABASE_PASSWORD", "strapi"),
      ssl: env.bool("DATABASE_SSL", false)
        ? { rejectUnauthorized: env.bool("DATABASE_SSL_REJECT_UNAUTHORIZED", false) }
        : false,
    },
    pool: { min: 0, max: 10 },
    acquireConnectionTimeout: 60000,
  },
});
