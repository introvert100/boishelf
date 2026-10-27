import { z } from "zod";
import { districts } from "./commerce-validation";

export const deliveryDistrictInput = z.object({
  district: z.enum(districts, { error: "Choose a Bangladesh district from the list." }),
  fee_paisa: z.number().int().min(0).max(1000000),
});
export const deliverySettingsInput = z.object({
  districts: z.array(deliveryDistrictInput).max(64).refine(
    (items) => new Set(items.map((item) => item.district)).size === items.length,
    "Each district can appear only once.",
  ),
});
export type DeliveryDistrict = z.infer<typeof deliveryDistrictInput>;

export function deliveryFee(rates: DeliveryDistrict[], district: string) {
  return rates.find((rate) => rate.district === district)?.fee_paisa ?? null;
}
