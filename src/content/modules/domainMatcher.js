/**
 * Domain Matcher Module - Domain Blacklist Matching Logic
 */

export const DEFAULT_BLACKLIST = [
  { domain: 'youtube.com', enabled: true },
  { domain: 'x.com', enabled: true },
  { domain: 'twitter.com', enabled: true },
  { domain: 'instagram.com', enabled: true },
  { domain: 'tiktok.com', enabled: true },
  { domain: 'facebook.com', enabled: true }
];

export function isDomainBlacklisted(hostname, blacklist) {
  if (!Array.isArray(blacklist) || blacklist.length === 0) return false;

  return blacklist.some(item => {
    if (!item.enabled) return false;
    const targetDomain = item.domain.toLowerCase().replace(/^(https?:\/\/)?(www\.)?/, '');
    const currentHost = hostname.toLowerCase().replace(/^(www\.)?/, '');

    return currentHost === targetDomain || currentHost.endsWith('.' + targetDomain);
  });
}
