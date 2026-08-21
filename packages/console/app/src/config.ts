/**
 * Application-wide constants and configuration
 */
export const config = {
  // Base URL
  baseUrl: "https://openctrlc.ai",

  // GitHub
  github: {
    repoUrl: "https://github.com/ponponon/openctrlc",
    starsFormatted: {
      compact: "195K",
      full: "195,000",
    },
  },

  // Social links
  social: {
    twitter: "https://x.com/openctrlc",
    discord: "https://discord.gg/openctrlc",
  },

  // Static stats (used on landing page)
  stats: {
    contributors: "950",
    commits: "13,000",
    monthlyUsers: "16M",
  },
} as const
