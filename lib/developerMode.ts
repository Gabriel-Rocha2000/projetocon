export const DEV_SESSION_KEY = "concurseiro-clt:dev-user";
export const STUDY_RETURN_KEY = "concurseiro-clt:return-to-study";

export function enableDeveloperMode(uid: string) {
  sessionStorage.setItem(DEV_SESSION_KEY, uid);
}
export function disableDeveloperMode() {
  sessionStorage.removeItem(DEV_SESSION_KEY);
}
export function isDeveloperSession(uid?: string | null) {
  return Boolean(uid && sessionStorage.getItem(DEV_SESSION_KEY) === uid);
}
export function getStudyReturnPath() {
  const candidate = sessionStorage.getItem(STUDY_RETURN_KEY) || "/dashboard";
  return candidate.startsWith("/") && !candidate.startsWith("//") && !candidate.startsWith("/desenvolvedor")
    ? candidate : "/dashboard";
}
