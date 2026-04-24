import "server-only";

import { cache } from "react";

import type {
  AnnouncementAttributes,
  EmployeeAttributes,
  FaqItemAttributes,
  HomeHeroAttributes,
  InfoPageAttributes,
  KnowledgeDocumentAttributes,
  NewsArticleAttributes,
  QuickActionAttributes,
  StrapiListResponse,
  StrapiSingleResponse,
  TrainingCourseAttributes,
  UsefulLinkAttributes,
  VacancyAttributes,
  VirtualReceptionAttributes,
} from "@/lib/types";
import { strapiFetch } from "@/lib/strapi";

const POPULATE_DEEP = "populate=*";

export async function fetchHomeHero() {
  return strapiFetch<StrapiSingleResponse<HomeHeroAttributes>>(`/api/home-hero?${POPULATE_DEEP}`);
}

export async function fetchVirtualReception() {
  return strapiFetch<StrapiSingleResponse<VirtualReceptionAttributes>>(`/api/virtual-reception?${POPULATE_DEEP}`);
}

export async function fetchAnnouncements(limit = 6) {
  const qs = new URLSearchParams({
    sort: "publishedAt:desc",
    "pagination[pageSize]": String(limit),
    publicationState: "live",
  });

  return strapiFetch<StrapiListResponse<AnnouncementAttributes>>(`/api/announcements?${qs.toString()}`);
}

export async function fetchNews(limit = 6) {
  const qs = new URLSearchParams({
    sort: "publishedAt:desc",
    "pagination[pageSize]": String(limit),
    publicationState: "live",
  });

  return strapiFetch<StrapiListResponse<NewsArticleAttributes>>(`/api/news-articles?${qs.toString()}`);
}

export async function fetchUsefulLinks(limit = 12) {
  const qs = new URLSearchParams({
    sort: "order:asc",
    "pagination[pageSize]": String(limit),
    publicationState: "live",
  });

  return strapiFetch<StrapiListResponse<UsefulLinkAttributes>>(`/api/useful-links?${qs.toString()}`);
}

export async function fetchQuickActions(limit = 8) {
  const qs = new URLSearchParams({
    sort: "order:asc",
    "pagination[pageSize]": String(limit),
  });

  return strapiFetch<StrapiListResponse<QuickActionAttributes>>(`/api/quick-actions?${qs.toString()}`);
}

export async function fetchEmployees() {
  const qs = new URLSearchParams({
    sort: "sortOrder:asc",
    "pagination[pageSize]": "200",
    publicationState: "live",
    "populate[department]": "*",
  });

  return strapiFetch<StrapiListResponse<EmployeeAttributes>>(`/api/employees?${qs.toString()}`);
}

export async function fetchInfoPages(section: InfoPageAttributes["section"]) {
  const qs = new URLSearchParams({
    sort: "navOrder:asc",
    "pagination[pageSize]": "200",
    publicationState: "live",
    "filters[section][$eq]": section,
    "populate[parent]": "*",
  });

  return strapiFetch<StrapiListResponse<InfoPageAttributes>>(`/api/info-pages?${qs.toString()}`);
}

export async function fetchInfoPageBySlug(slug: string) {
  const qs = new URLSearchParams({
    "filters[slug][$eq]": slug,
    publicationState: "live",
    "populate[parent][populate][parent]": "*",
  });

  return strapiFetch<StrapiListResponse<InfoPageAttributes>>(`/api/info-pages?${qs.toString()}`);
}

export async function fetchTrainingCourses() {
  const qs = new URLSearchParams({
    sort: "order:asc",
    "pagination[pageSize]": "100",
    publicationState: "live",
  });

  return strapiFetch<StrapiListResponse<TrainingCourseAttributes>>(`/api/training-courses?${qs.toString()}`);
}

export async function fetchTrainingCourseBySlug(slug: string) {
  const qs = new URLSearchParams({
    "filters[slug][$eq]": slug,
    publicationState: "live",
  });

  return strapiFetch<StrapiListResponse<TrainingCourseAttributes>>(`/api/training-courses?${qs.toString()}`);
}

export async function fetchVacancies() {
  const qs = new URLSearchParams({
    sort: "publishedAt:desc",
    "pagination[pageSize]": "100",
    publicationState: "live",
    "populate[department]": "*",
  });

  return strapiFetch<StrapiListResponse<VacancyAttributes>>(`/api/vacancies?${qs.toString()}`);
}

export async function fetchVacancyBySlug(slug: string) {
  const qs = new URLSearchParams({
    "filters[slug][$eq]": slug,
    publicationState: "live",
    "populate[department]": "*",
  });

  return strapiFetch<StrapiListResponse<VacancyAttributes>>(`/api/vacancies?${qs.toString()}`);
}

export async function fetchFaqItems() {
  const qs = new URLSearchParams({
    sort: "order:asc",
    "pagination[pageSize]": "200",
    publicationState: "live",
  });

  return strapiFetch<StrapiListResponse<FaqItemAttributes>>(`/api/faq-items?${qs.toString()}`);
}

export async function fetchKnowledgeDocuments(limit = 50) {
  const qs = new URLSearchParams({
    sort: "publishedAt:desc",
    "pagination[pageSize]": String(limit),
    publicationState: "live",
  });

  return strapiFetch<StrapiListResponse<KnowledgeDocumentAttributes>>(`/api/knowledge-documents?${qs.toString()}`);
}

export const getCachedInfoPages = cache((section: InfoPageAttributes["section"]) => fetchInfoPages(section));

export const getCachedInfoPageBySlug = cache((slug: string) => fetchInfoPageBySlug(slug));
