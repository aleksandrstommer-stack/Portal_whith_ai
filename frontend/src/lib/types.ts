export type StrapiMeta = {
  pagination?: {
    page: number;
    pageSize: number;
    pageCount: number;
    total: number;
  };
};

export type StrapiListResponse<T> = {
  data: StrapiEntity<T>[];
  meta: StrapiMeta;
};

export type StrapiSingleResponse<T> = {
  data: StrapiEntity<T> | null;
  meta: StrapiMeta;
};

export type StrapiEntity<T> = {
  id: number;
  attributes: T & {
    createdAt?: string;
    updatedAt?: string;
    publishedAt?: string | null;
  };
};

export type DepartmentAttributes = {
  name: string;
  slug: string;
  description?: string | null;
};

export type EmployeeAttributes = {
  fullName: string;
  slug: string;
  jobTitle: string;
  email?: string | null;
  phone?: string | null;
  office?: string | null;
  bio?: string | null;
  sortOrder?: number | null;
  department?: { data: StrapiEntity<DepartmentAttributes> | null };
};

export type NewsArticleAttributes = {
  title: string;
  slug: string;
  excerpt: string;
  body: string;
  featured?: boolean | null;
};

export type InfoPageAttributes = {
  title: string;
  slug: string;
  summary?: string | null;
  body: string;
  section: "official" | "personnel" | "compliance";
  navOrder?: number | null;
  parent?: { data: StrapiEntity<InfoPageAttributes> | null };
};

export type TrainingCourseAttributes = {
  title: string;
  slug: string;
  summary: string;
  body: string;
  durationHours?: number | null;
  level: "beginner" | "intermediate" | "advanced";
  order?: number | null;
};

export type VacancyAttributes = {
  title: string;
  slug: string;
  location: string;
  employmentType: "full_time" | "part_time" | "contract" | "internship";
  salaryRange?: string | null;
  body: string;
  department?: { data: StrapiEntity<DepartmentAttributes> | null };
};

export type FaqItemAttributes = {
  question: string;
  answer: string;
  category?: string | null;
  order?: number | null;
};

export type UsefulLinkAttributes = {
  title: string;
  url: string;
  description?: string | null;
  groupName?: string | null;
  order?: number | null;
};

export type AnnouncementAttributes = {
  title: string;
  body: string;
  priority: "normal" | "high";
  validUntil?: string | null;
};

export type QuickActionAttributes = {
  label: string;
  href: string;
  hint?: string | null;
  icon: "mail" | "calendar" | "user" | "file" | "link" | "phone" | "sparkles";
  order?: number | null;
};

export type HomeHeroAttributes = {
  headline: string;
  subheadline: string;
  badge?: string | null;
  primaryCtaLabel: string;
  primaryCtaHref: string;
  secondaryCtaLabel?: string | null;
  secondaryCtaHref?: string | null;
  backgroundTint: "light" | "strong";
};

export type VirtualReceptionAttributes = {
  title: string;
  lead: string;
  body: string;
  hotline: string;
  email: string;
  schedule: string;
};

export type KnowledgeDocumentAttributes = {
  title: string;
  slug: string;
  abstract?: string | null;
  body: string;
  tags?: string | null;
  source?: string | null;
  embeddingMeta?: Record<string, unknown> | null;
};
