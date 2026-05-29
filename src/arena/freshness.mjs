import { asArray, asNumber, asRecord, asString } from "./core.mjs";

const DEFAULT_MIN_X_POSTS = 1;
const BLOCKING_ERROR_PATTERN =
  /CreditsDepleted|402 Payment Required|problems\/credits|401|403|unauthorized|forbidden|api key|permission/i;

const snapshotMeta = (snapshot) => asRecord(snapshot?.meta);
const snapshotStatus = (snapshot) => asRecord(snapshot?.status);
const dashboardMeta = (snapshot) => asRecord(snapshot?.views?.dashboard?.meta ?? snapshot?.dashboard?.meta);
const dashboardStatus = (snapshot) => asRecord(snapshot?.views?.dashboard?.status ?? snapshot?.dashboard?.status);

export const collectFreshIntelMessages = (snapshot) => [
  ...asArray(snapshotMeta(snapshot).errors),
  ...asArray(snapshotMeta(snapshot).warnings),
  ...asArray(dashboardMeta(snapshot).errors),
  ...asArray(dashboardMeta(snapshot).warnings)
].map((message) => asString(message)).filter(Boolean);

export const assessFreshIntelSnapshot = (snapshot, options = {}) => {
  const label = asString(options.label, "snapshot");
  const minXPosts = Math.max(1, asNumber(options.minXPosts, DEFAULT_MIN_X_POSTS));
  const topStatus = snapshotStatus(snapshot);
  const viewStatus = dashboardStatus(snapshot);
  const streamOk = topStatus.streamOk !== false && viewStatus.streamOk !== false;
  const xPostsToday = Math.max(asNumber(topStatus.xPostsToday, 0), asNumber(viewStatus.xPostsToday, 0));
  const messages = collectFreshIntelMessages(snapshot);
  const errors = [];

  if (!streamOk) {
    errors.push(`${label}: streamOk is false`);
  }

  if (xPostsToday < minXPosts) {
    errors.push(`${label}: expected at least ${minXPosts} fresh X post(s), found ${xPostsToday}`);
  }

  const blockingMessage = messages.find((message) => BLOCKING_ERROR_PATTERN.test(message));
  if (blockingMessage) {
    errors.push(`${label}: blocking X/intel error detected: ${blockingMessage}`);
  }

  return {
    ok: errors.length === 0,
    label,
    streamOk,
    xPostsToday,
    minXPosts,
    errors,
    messages
  };
};

export const assertFreshIntelSnapshot = (snapshot, options = {}) => {
  const result = assessFreshIntelSnapshot(snapshot, options);
  if (!result.ok) {
    throw new Error(result.errors.join("\n"));
  }
  return result;
};
