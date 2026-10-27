import { z } from "zod";

export const checkoutControlsInput = z.object({
  bkashEnabled: z.boolean(), codEnabled: z.boolean(),
  businessConfirmed: z.boolean(), courierConfirmed: z.boolean(),
}).superRefine((value, context) => {
  if (value.bkashEnabled && !value.businessConfirmed)
    context.addIssue({ code: "custom", path: ["businessConfirmed"], message: "Confirm your eligible bKash business account before enabling bKash." });
  if (value.codEnabled && !value.courierConfirmed)
    context.addIssue({ code: "custom", path: ["courierConfirmed"], message: "Confirm your COD courier arrangement before enabling cash on delivery." });
});
export type CheckoutControls = z.infer<typeof checkoutControlsInput>;
export const closedCheckout: CheckoutControls = {
  bkashEnabled: false, codEnabled: false, businessConfirmed: false, courierConfirmed: false,
};
