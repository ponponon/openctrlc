const stage = process.env.SST_STAGE || "dev"
const url = stage === "production" ? "https://openctrlc-docs.pages.dev" : `https://${stage}.openctrlc-docs.pages.dev`

export default {
  url,
  console: url,
  email: "ponponon.universe@gmail.com",
  github: "https://github.com/ponponon/openctrlc",
  headerLinks: [
    { name: "app.header.home", url: "/" },
    { name: "app.header.docs", url: "/docs/" },
  ],
}
