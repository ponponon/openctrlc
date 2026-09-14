import { type ComponentProps } from "solid-js"
import mascot from "../assets/openctrlc-mascot.png"

export const Mark = (props: { class?: string }) => {
  return (
    <svg
      data-component="logo-mark"
      classList={{ [props.class ?? ""]: !!props.class }}
      viewBox="0 0 16 20"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <image href={mascot} width="16" height="20" preserveAspectRatio="xMidYMid slice" />
    </svg>
  )
}

export const Splash = (props: Pick<ComponentProps<"svg">, "ref" | "class">) => {
  return (
    <svg
      ref={props.ref}
      data-component="logo-splash"
      classList={{ [props.class ?? ""]: !!props.class }}
      viewBox="0 0 80 100"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <image href={mascot} width="80" height="100" preserveAspectRatio="xMidYMid slice" />
    </svg>
  )
}

export const Logo = (props: { class?: string }) => {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 204 42"
      fill="none"
      classList={{ [props.class ?? ""]: !!props.class }}
    >
      <image href={mascot} x="0" y="6" width="24" height="30" preserveAspectRatio="xMidYMid slice" />
      <text
        x="31"
        y="31"
        fill="var(--icon-strong-base)"
        font-family="IBM Plex Mono, ui-monospace, SFMono-Regular, Menlo, monospace"
        font-size="28"
        font-weight="700"
        letter-spacing="-1.4"
      >
        OpenCtrlC
      </text>
    </svg>
  )
}
