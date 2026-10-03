/**
 * What the assistant may type into forms for you (name, phone, address ...) and
 * the logins it created for you. Both are sealed with the vault key before they
 * reach the database; they are opened only to fill a form or to show you.
 * Stored as preferences under a prefix so they ride the existing project store.
 */
import "server-only";
import { prisma } from "@/lib/platform/db";
import { open, seal } from "@/lib/auth/vault";

const DETAIL = "detail:";
const LOGIN = "login:";

export interface Detail {
  label: string;
  value: string;
}
export interface Login {
  site: string;
  username: string;
  password: string;
}

const clean = (text: string, max: number) => text.replace(/\s+/g, " ").trim().slice(0, max);

export async function listDetails(projectId: string): Promise<Detail[]> {
  const rows = await prisma.lifePreference.findMany({ where: { projectId, key: { startsWith: DETAIL } }, orderBy: { key: "asc" } });
  return rows.flatMap((row) => {
    try {
      return [{ label: row.key.slice(DETAIL.length), value: open<string>(row.value) }];
    } catch {
      return [];
    }
  });
}

export async function setDetail(projectId: string, label: string, value: string): Promise<void> {
  const name = clean(label, 60);
  const text = clean(value, 300);
  if (!name || !text) throw new Error("A detail needs a name and a value.");
  await prisma.lifePreference.upsert({
    where: { projectId_key: { projectId, key: DETAIL + name } },
    create: { projectId, key: DETAIL + name, value: seal(text) },
    update: { value: seal(text) },
  });
}

export async function removeDetail(projectId: string, label: string): Promise<void> {
  await prisma.lifePreference.deleteMany({ where: { projectId, key: DETAIL + label } });
}

export async function saveLogin(projectId: string, login: Login): Promise<void> {
  const site = clean(login.site, 120).toLowerCase();
  if (!site || !login.password) throw new Error("A login needs a site and a password.");
  const value = seal({ username: clean(login.username, 160), password: login.password });
  await prisma.lifePreference.upsert({
    where: { projectId_key: { projectId, key: LOGIN + site } },
    create: { projectId, key: LOGIN + site, value },
    update: { value },
  });
}

/** Sites and usernames only: the password is opened separately, on request. */
export async function listLogins(projectId: string): Promise<Pick<Login, "site" | "username">[]> {
  const rows = await prisma.lifePreference.findMany({ where: { projectId, key: { startsWith: LOGIN } }, orderBy: { key: "asc" } });
  return rows.flatMap((row) => {
    try {
      return [{ site: row.key.slice(LOGIN.length), username: open<{ username: string }>(row.value).username }];
    } catch {
      return [];
    }
  });
}

export async function revealLogin(projectId: string, site: string): Promise<Login | null> {
  const row = await prisma.lifePreference.findUnique({ where: { projectId_key: { projectId, key: LOGIN + site } } });
  if (!row) return null;
  try {
    return { site, ...open<{ username: string; password: string }>(row.value) };
  } catch {
    return null;
  }
}

export async function removeLogin(projectId: string, site: string): Promise<void> {
  await prisma.lifePreference.deleteMany({ where: { projectId, key: LOGIN + site } });
}
