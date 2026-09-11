import { z } from "zod"
import { fn } from "./util/fn"
import { Resource } from "@openctrlc/console-resource"
import { Subscription } from "./subscription"

const litePrice = (() => {
  try {
    return Resource.ZEN_LITE_PRICE
  } catch {
    // The public OpenCtrlC Pages deployment has no hosted billing resources.
    return undefined
  }
})()

export namespace LiteData {
  export const getLimits = fn(z.void(), () => {
    return Subscription.getLimits()["lite"]
  })

  export const productID = fn(z.void(), () => Resource.ZEN_LITE_PRICE.product)
  export const priceID = fn(z.void(), () => Resource.ZEN_LITE_PRICE.price)
  export const priceInr = fn(z.void(), () => Resource.ZEN_LITE_PRICE.priceInr)
  export const firstMonth100Coupon = litePrice?.firstMonth100Coupon
  export const firstMonth50Coupon = litePrice?.firstMonth50Coupon
  export const threeMonths100Coupon = litePrice?.threeMonths100Coupon
  export const sixMonths100Coupon = litePrice?.sixMonths100Coupon
  export const twelveMonths100Coupon = litePrice?.twelveMonths100Coupon
  export const planName = fn(z.void(), () => "lite")
}
