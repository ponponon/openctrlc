const stage = process.env.SST_STAGE || "dev"
const url = stage === "production" ? "https://openctrlc.pages.dev" : `https://${stage}.openctrlc.pages.dev`

export default {
  url,
  console: url,
  email: "help@anoma.ly",
  github: "https://github.com/ponponon/openctrlc",
  discord: "https://github.com/ponponon/openctrlc/discussions",
  headerLinks: [
    { name: "app.header.home", url: "/" },
    { name: "app.header.docs", url: "/docs/" },
  ],
}
