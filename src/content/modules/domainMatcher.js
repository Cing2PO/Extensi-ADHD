/**
 * Domain Matcher Module - Domain Blacklist Matching Logic
 */

import { DEFAULT_BLACKLIST } from '../../shared/constants.js';
export { DEFAULT_BLACKLIST };

export function isDomainBlacklisted(hostname, blacklist) {
  if (!Array.isArray(blacklist) || blacklist.length === 0) return false;

  return blacklist.some(item => {
    if (!item.enabled) return false;
    const targetDomain = item.domain.toLowerCase().replace(/^(https?:\/\/)?(www\.)?/, '');
    const currentHost = hostname.toLowerCase().replace(/^(www\.)?/, '');

    return currentHost === targetDomain || currentHost.endsWith('.' + targetDomain);
  });
}
