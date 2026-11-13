// Domain validation and normalization for the blocklist (FR-12, SRS 9.1).
// Pure function: no browser APIs, easy to test.

export type DomainResult =
  | { ok: true; domain: string; droppedPath: boolean }
  | { ok: false; error: string };

const SCHEME = /^([a-z][a-z0-9+.-]*):\/\//i;
const LABEL = /^(?!-)[a-z0-9-]{1,63}(?<!-)$/;
const TLD = /^([a-z]{2,63}|xn--[a-z0-9-]+)$/;

function fail(error: string): DomainResult {
  return { ok: false, error };
}

const IP_MESSAGE = "IP addresses can't be blocked. Enter a domain name such as example.com.";
const INVALID_MESSAGE = "That doesn't look like a valid domain. Use letters, numbers and hyphens, for example example.com.";

// "https://www.YouTube.com/watch?v=1"  ->  "youtube.com" (droppedPath: true)
// "*.reddit.com"                       ->  "reddit.com"
// Subdomains of the result are blocked too, so www.example.com needs no entry.
export function normalizeDomain(input: string): DomainResult {
  let text = input.trim();
  if (text === "") return fail("Enter a website, for example youtube.com.");
  if (/\s/.test(text)) return fail("A website can't contain spaces.");

  const scheme = SCHEME.exec(text);
  if (scheme) {
    if (!/^https?$/i.test(scheme[1])) return fail("Only http and https websites can be blocked.");
  } else {
    text = `http://${text}`;
  }
  text = text.replace(/^(https?:\/\/)\*\./i, "$1"); // allow "*.example.com"

  let url: URL;
  try {
    url = new URL(text);
  } catch {
    return fail("That doesn't look like a valid website address.");
  }
  if (url.username || url.password) {
    return fail("Remove the username and password and enter only the website address.");
  }

  let host = url.hostname.toLowerCase().replace(/\.$/, "");
  if (host.startsWith("www.")) host = host.slice(4);

  if (host.includes(":") || host.startsWith("[")) return fail(IP_MESSAGE);
  const labels = host.split(".");
  if (labels.length < 2) {
    return fail('Enter a full domain such as example.com. Names like "localhost" aren\'t supported.');
  }
  if (/^\d+$/.test(labels[labels.length - 1])) return fail(IP_MESSAGE);
  if (host.length > 253 || !labels.every((label) => LABEL.test(label)) || !TLD.test(labels[labels.length - 1])) {
    return fail(INVALID_MESSAGE);
  }

  const droppedPath = (url.pathname !== "/" && url.pathname !== "") || url.search !== "" || url.hash !== "";
  return { ok: true, domain: host, droppedPath };
}
