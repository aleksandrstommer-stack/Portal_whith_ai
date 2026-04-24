import type { LoadedStrapi } from "@strapi/strapi";

const READ_ACTIONS = [
  "api::department.department.find",
  "api::department.department.findOne",
  "api::employee.employee.find",
  "api::employee.employee.findOne",
  "api::news-article.news-article.find",
  "api::news-article.news-article.findOne",
  "api::info-page.info-page.find",
  "api::info-page.info-page.findOne",
  "api::training-course.training-course.find",
  "api::training-course.training-course.findOne",
  "api::vacancy.vacancy.find",
  "api::vacancy.vacancy.findOne",
  "api::faq-item.faq-item.find",
  "api::faq-item.faq-item.findOne",
  "api::useful-link.useful-link.find",
  "api::useful-link.useful-link.findOne",
  "api::announcement.announcement.find",
  "api::announcement.announcement.findOne",
  "api::quick-action.quick-action.find",
  "api::quick-action.quick-action.findOne",
  "api::knowledge-document.knowledge-document.find",
  "api::knowledge-document.knowledge-document.findOne",
  // singleType: только find (без findOne)
  "api::home-hero.home-hero.find",
  "api::virtual-reception.virtual-reception.find",
  "plugin::upload.content-api.find",
  "plugin::upload.content-api.findOne",
];

const WRITE_ACTIONS = [
  "api::application-message.application-message.create",
  "api::knowledge-test-attempt.knowledge-test-attempt.create",
  "api::knowledge-test-attempt.knowledge-test-attempt.find",
  "api::knowledge-test-attempt.knowledge-test-attempt.findOne",
  "api::knowledge-test-attempt.knowledge-test-attempt.update",
];

async function enablePublicPermissions(strapi: LoadedStrapi) {
  const publicRole = await strapi.db.query("plugin::users-permissions.role").findOne({
    where: { type: "public" },
  });

  if (!publicRole) {
    strapi.log.warn("bootstrap: public role not found, skip permissions");
    return;
  }

  const actions = [...READ_ACTIONS, ...WRITE_ACTIONS];

  for (const action of actions) {
    const existing = await strapi.db.query("plugin::users-permissions.permission").findOne({
      where: { action, role: publicRole.id },
    });

    if (existing) {
      continue;
    }

    try {
      await strapi.db.query("plugin::users-permissions.permission").create({
        data: {
          action,
          role: publicRole.id,
        },
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      strapi.log.warn(`bootstrap: could not create permission ${action}: ${message}`);
    }
  }
}

async function seedIfEmpty(strapi: LoadedStrapi) {
  const existing = await strapi.db.query("api::department.department").count();
  if (existing > 0) {
    strapi.log.info("bootstrap: demo data already present, skip seed");
    return;
  }

  strapi.log.info("bootstrap: seeding demo content");

  const it = await strapi.entityService.create("api::department.department", {
    data: {
      name: "ИТ и цифровизация",
      slug: "it",
      description: "Инфраструктура, безопасность, внутренние сервисы и поддержка пользователей.",
    },
  });

  const hr = await strapi.entityService.create("api::department.department", {
    data: {
      name: "Кадры и корпоративная культура",
      slug: "hr",
      description: "Подбор, адаптация, обучение и внутренние коммуникации.",
    },
  });

  const legal = await strapi.entityService.create("api::department.department", {
    data: {
      name: "Юридический департамент",
      slug: "legal",
      description: "Договорная работа, комплаенс и защита интересов компании.",
    },
  });

  const published = { publishedAt: new Date() };

  await strapi.entityService.create("api::employee.employee", {
    data: {
      fullName: "Анна Смирнова",
      slug: "anna-smirnova",
      jobTitle: "Руководитель направления ИТ",
      email: "a.smirnova@example.corp",
      phone: "+7 (495) 000-11-22",
      office: "Москва, БЦ «Север», 12 этаж",
      bio: "<p>Отвечает за дорожную карту цифровизации и стабильность ключевых сервисов.</p>",
      sortOrder: 10,
      department: it.id,
      ...published,
    },
  });

  await strapi.entityService.create("api::employee.employee", {
    data: {
      fullName: "Дмитрий Орлов",
      slug: "dmitriy-orlov",
      jobTitle: "Ведущий инженер поддержки",
      email: "d.orlov@example.corp",
      phone: "+7 (495) 000-33-44",
      office: "Удалённо, МСК+3",
      bio: "<p>Курирует инциденты, SLA и базу знаний для пользователей.</p>",
      sortOrder: 20,
      department: it.id,
      ...published,
    },
  });

  await strapi.entityService.create("api::employee.employee", {
    data: {
      fullName: "Елена Кузнецова",
      slug: "elena-kuznetsova",
      jobTitle: "HR BP, корпоративное обучение",
      email: "e.kuznetsova@example.corp",
      phone: "+7 (495) 000-55-66",
      office: "Санкт-Петербург, Невский проспект",
      bio: "<p>Проекты адаптации, оценка и развитие, внутренний портал как канал HR.</p>",
      sortOrder: 30,
      department: hr.id,
      ...published,
    },
  });

  await strapi.entityService.create("api::employee.employee", {
    data: {
      fullName: "Игорь Васильев",
      slug: "igor-vasiliev",
      jobTitle: "Юрисконсульт",
      email: "i.vasiliev@example.corp",
      phone: "+7 (495) 000-77-88",
      office: "Москва, юридический блок",
      bio: "<p>Сопровождение договоров, NDA, работа с обращениями сотрудников.</p>",
      sortOrder: 40,
      department: legal.id,
      ...published,
    },
  });

  await strapi.entityService.create("api::news-article.news-article", {
    data: {
      title: "Запуск обновлённого корпоративного портала",
      slug: "portal-launch",
      excerpt: "Единая точка входа к новостям, регламентам и сервисам компании.",
      body: "<p>Мы собрали ключевые разделы в современном интерфейсе, чтобы сократить время поиска информации и упростить обращения в службы.</p><p>Обратная связь приветствуется через форму «Заявки и обращения».</p>",
      featured: true,
      ...published,
    },
  });

  await strapi.entityService.create("api::news-article.news-article", {
    data: {
      title: "График обновления ИТ-систем на майские праздники",
      slug: "it-may-holidays",
      excerpt: "Плановые окна и контакты дежурных команд.",
      body: "<p>В праздничные дни дежурные смены работают по сокращённому графику. Критичные сервисы остаются под мониторингом 24/7.</p>",
      featured: false,
      ...published,
    },
  });

  await strapi.entityService.create("api::news-article.news-article", {
    data: {
      title: "Новый цикл программы наставничества",
      slug: "mentorship-cycle",
      excerpt: "Регистрация до конца месяца, формат — смешанный.",
      body: "<p>Программа охватывает продуктовые, инженерные и клиентские роли. Подробности в разделе «Обучение».</p>",
      featured: false,
      ...published,
    },
  });

  const rootPolicy = await strapi.entityService.create("api::info-page.info-page", {
    data: {
      title: "Политика информационной безопасности",
      slug: "information-security-policy",
      summary: "Базовые требования к рабочим устройствам, паролям и обмену данными.",
      body: "<p>Документ определяет минимальный уровень защиты корпоративной информации и обязанности сотрудников.</p><ul><li>двухфакторная аутентификация на критичных сервисах;</li><li>запрет на передачу учётных данных третьим лицам;</li><li>немедленное сообщение об инцидентах в ИТ.</li></ul>",
      section: "official",
      navOrder: 10,
      ...published,
    },
  });

  await strapi.entityService.create("api::info-page.info-page", {
    data: {
      title: "Инциденты и эскалация",
      slug: "security-incidents",
      summary: "Как действовать при подозрении на утечку или компрометацию.",
      body: "<p>Сообщите руководителю и в ИТ-службу в течение 15 минут. Не пытайтесь самостоятельно «лечить» рабочую станцию без инструкции.</p>",
      section: "official",
      navOrder: 20,
      parent: rootPolicy.id,
      ...published,
    },
  });

  await strapi.entityService.create("api::info-page.info-page", {
    data: {
      title: "Кодекс делового поведения",
      slug: "code-of-conduct",
      summary: "Принципы честности, уважения и ответственности в работе.",
      body: "<p>Кодекс применяется ко всем сотрудникам и подрядчикам. Нарушения рассматриваются комиссией по этике.</p>",
      section: "compliance",
      navOrder: 30,
      ...published,
    },
  });

  await strapi.entityService.create("api::info-page.info-page", {
    data: {
      title: "Льготы и компенсации",
      slug: "benefits-overview",
      summary: "ДМС, спорт, обучение, гибкий график — в одном месте.",
      body: "<p>Актуальный перечень льгот согласовывается ежегодно. Детали уточняйте у HR BP своего направления.</p>",
      section: "personnel",
      navOrder: 40,
      ...published,
    },
  });

  await strapi.entityService.create("api::training-course.training-course", {
    data: {
      title: "Онбординг: корпоративные сервисы за 45 минут",
      slug: "onboarding-services",
      summary: "Почта, календарь, документооборот, VPN и базовые правила ИБ.",
      body: "<p>Практический трек для новых сотрудников: где искать регламенты, как оформлять заявки, куда писать при сбоях.</p>",
      durationHours: 0.75,
      level: "beginner",
      order: 10,
      ...published,
    },
  });

  await strapi.entityService.create("api::training-course.training-course", {
    data: {
      title: "Эффективные переговоры и фасилитация",
      slug: "negotiation-facilitation",
      summary: "Рамки подготовки, работа с возражениями, фиксация договорённостей.",
      body: "<p>Курс для руководителей проектных команд: кейсы, чек-листы, разбор записей встреч.</p>",
      durationHours: 6,
      level: "intermediate",
      order: 20,
      ...published,
    },
  });

  await strapi.entityService.create("api::vacancy.vacancy", {
    data: {
      title: "Инженер данных (middle)",
      slug: "data-engineer-middle",
      location: "Москва / гибрид",
      employmentType: "full_time",
      salaryRange: "по результатам собеседования",
      body: "<p>Ожидаем опыт с SQL, оркестраторами и облачными хранилищами. Будет плюсом понимание корпоративных политик ИБ.</p>",
      department: it.id,
      ...published,
    },
  });

  await strapi.entityService.create("api::vacancy.vacancy", {
    data: {
      title: "Специалист по обучению и развитию",
      slug: "lnd-specialist",
      location: "Санкт-Петербург",
      employmentType: "full_time",
      salaryRange: "диапазон обсуждается",
      body: "<p>Задачи: дизайн программ, взаимодействие с внутренними заказчиками, аналитика эффективности обучения.</p>",
      department: hr.id,
      ...published,
    },
  });

  await strapi.entityService.create("api::faq-item.faq-item", {
    data: {
      question: "Как сбросить пароль к корпоративной почте?",
      answer: "<p>Откройте страницу входа в почту и выберите «Забыли пароль». Если письмо не приходит за 10 минут, создайте заявку в ИТ с темой «Почта».</p>",
      category: "ИТ",
      order: 10,
      ...published,
    },
  });

  await strapi.entityService.create("api::faq-item.faq-item", {
    data: {
      question: "Где найти шаблон NDA для подрядчика?",
      answer: "<p>Актуальные шаблоны размещены в разделе «Официальная информация» → «Комплаенс». При сомнениях согласуйте текст с юридическим департаментом.</p>",
      category: "Юридические вопросы",
      order: 20,
      ...published,
    },
  });

  await strapi.entityService.create("api::faq-item.faq-item", {
    data: {
      question: "Как записаться на программу наставничества?",
      answer: "<p>В разделе «Обучение» откройте карточку программы и следуйте ссылке на внутреннюю форму. HR свяжется с вами в течение 5 рабочих дней.</p>",
      category: "HR",
      order: 30,
      ...published,
    },
  });

  await strapi.entityService.create("api::useful-link.useful-link", {
    data: {
      title: "Корпоративная почта",
      url: "https://mail.example.corp",
      description: "Вход в рабочий ящик и календарь",
      groupName: "Коммуникации",
      order: 10,
      ...published,
    },
  });

  await strapi.entityService.create("api::useful-link.useful-link", {
    data: {
      title: "Система заявок ИТ",
      url: "https://itsm.example.corp",
      description: "Инциденты, доступы, оборудование",
      groupName: "Сервисы",
      order: 20,
      ...published,
    },
  });

  await strapi.entityService.create("api::useful-link.useful-link", {
    data: {
      title: "База знаний для AI-ассистента (демо)",
      url: "/chat",
      description: "Черновой интерфейс чата и будущий RAG",
      groupName: "Пилоты",
      order: 30,
      ...published,
    },
  });

  await strapi.entityService.create("api::announcement.announcement", {
    data: {
      title: "Плановое обновление портала",
      body: "<p>Сегодня в 22:00 возможны кратковременные перебои до 15 минут.</p>",
      priority: "high",
      ...published,
    },
  });

  await strapi.entityService.create("api::announcement.announcement", {
    data: {
      title: "Добро пожаловать в обновлённый раздел «Официальная информация»",
      body: "<p>Добавлены хлебные крошки и боковая навигация для удобной работы с документами.</p>",
      priority: "normal",
      ...published,
    },
  });

  await strapi.entityService.create("api::quick-action.quick-action", {
    data: {
      label: "Заявка в ИТ",
      href: "/applications",
      hint: "Доступы, оборудование, инциденты",
      icon: "mail",
      order: 10,
    },
  });

  await strapi.entityService.create("api::quick-action.quick-action", {
    data: {
      label: "Вакансии",
      href: "/vacancies",
      hint: "Открытые позиции и отклик",
      icon: "user",
      order: 20,
    },
  });

  await strapi.entityService.create("api::quick-action.quick-action", {
    data: {
      label: "Обучение",
      href: "/training",
      hint: "Программы и материалы",
      icon: "file",
      order: 30,
    },
  });

  await strapi.entityService.create("api::quick-action.quick-action", {
    data: {
      label: "Виртуальная приёмная",
      href: "/reception",
      hint: "Контакты и режим работы",
      icon: "phone",
      order: 40,
    },
  });

  await strapi.entityService.create("api::knowledge-document.knowledge-document", {
    data: {
      title: "Регламент обращений в ИТ-службу",
      slug: "it-support-playbook",
      abstract: "Классификация обращений, SLA и каналы эскалации.",
      body: "<p>Цель документа — ускорить обработку запросов и снизить количество дублей. Используйте единый шаблон заявки и указывайте влияние на бизнес-процесс.</p>",
      tags: "it,support,sla",
      source: "Внутренний регламент (демо)",
      embeddingMeta: { model: null, dimensions: null, updatedAt: null },
      ...published,
    },
  });

  await strapi.entityService.create("api::knowledge-document.knowledge-document", {
    data: {
      title: "HR: процесс адаптации на 30-60-90 дней",
      slug: "hr-onboarding-30-60-90",
      abstract: "Чек-листы для руководителя и сотрудника.",
      body: "<p>День 30 — цели и контекст команды. День 60 — первая обратная связь. День 90 — итоговая оценка и план развития.</p>",
      tags: "hr,onboarding",
      source: "HR knowledge pack (демо)",
      embeddingMeta: { model: null, dimensions: null, updatedAt: null },
      ...published,
    },
  });

  await strapi.entityService.create("api::home-hero.home-hero", {
    data: {
      headline: "Корпоративный портал нового поколения",
      subheadline:
        "Новости, регламенты, люди и сервисы — в одном месте. Меньше поиска, больше ясности в ежедневной работе.",
      badge: "MVP для локального запуска",
      primaryCtaLabel: "К новостям",
      primaryCtaHref: "/news",
      secondaryCtaLabel: "Официальная информация",
      secondaryCtaHref: "/official",
      backgroundTint: "light",
      ...published,
    },
  });

  await strapi.entityService.create("api::virtual-reception.virtual-reception", {
    data: {
      title: "Виртуальная приёмная",
      lead: "Здесь собраны каналы для вопросов, которые не требуют личного визита, но важны для вашего комфорта и прозрачности процессов.",
      body: "<p>Мы отвечаем на обращения в порядке очереди с учётом приоритета темы. Для срочных ИТ-инцидентов используйте дежурную линию.</p>",
      hotline: "+7 (800) 000-00-01",
      email: "reception@example.corp",
      schedule: "<p>Пн–Пт: 09:00–18:00 по местному времени офиса.<br/>Сб–Вс: только автоответчик и экстренные сценарии.</p>",
      ...published,
    },
  });

  strapi.log.info("bootstrap: demo seed completed");
}

export async function runBootstrap(strapi: LoadedStrapi) {
  await enablePublicPermissions(strapi);
  await seedIfEmpty(strapi);
}
