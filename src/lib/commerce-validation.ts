import { z } from "zod";

export const districts = [
  "Bagerhat","Bandarban","Barguna","Barishal","Bhola","Bogura","Brahmanbaria","Chandpur",
  "Chapainawabganj","Chattogram","Chuadanga","Cox's Bazar","Cumilla","Dhaka","Dinajpur",
  "Faridpur","Feni","Gaibandha","Gazipur","Gopalganj","Habiganj","Jamalpur","Jashore",
  "Jhalokati","Jhenaidah","Joypurhat","Khagrachhari","Khulna","Kishoreganj","Kurigram",
  "Kushtia","Lakshmipur","Lalmonirhat","Madaripur","Magura","Manikganj","Meherpur",
  "Moulvibazar","Munshiganj","Mymensingh","Naogaon","Narail","Narayanganj","Narsingdi",
  "Natore","Netrokona","Nilphamari","Noakhali","Pabna","Panchagarh","Patuakhali",
  "Pirojpur","Rajbari","Rajshahi","Rangamati","Rangpur","Satkhira","Shariatpur",
  "Sherpur","Sirajganj","Sunamganj","Sylhet","Tangail","Thakurgaon",
] as const;
export const cartLineInput = z.object({
  kind: z.enum(["book","bundle"]), id: z.uuid(), quantity: z.number().int().min(1).max(10),
});
export const cartInput = z.array(cartLineInput).min(1).max(20)
  .refine((lines) => new Set(lines.map((line) => `${line.kind}:${line.id}`)).size === lines.length,
    "Each item may appear only once. Change its quantity instead.");
export const shippingInput = z.object({
  recipientName: z.string().trim().min(2).max(100),
  phone: z.string().regex(/^01[3-9]\d{8}$/, "Enter an 11-digit Bangladesh mobile number."),
  district: z.enum(districts),
  localArea: z.string().trim().min(2).max(120),
  streetAddress: z.string().trim().min(5).max(300),
});
export const physicalCheckoutInput = shippingInput.extend({
  clientKey: z.uuid(), lines: cartInput, method: z.enum(["cod","bkash_manual"]),
  expectedTotalPaisa: z.number().int().positive(), accepted: z.literal(true),
});
export const bundleInput = z.object({
  id: z.uuid().optional(),
  slug: z.string().min(3).max(90).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
  kind: z.enum(["ebook","physical"]),
  title_bn: z.string().trim().min(2).max(160), title_en: z.string().trim().min(2).max(160),
  description_bn: z.string().trim().min(10).max(5000),
  description_en: z.string().trim().min(10).max(5000),
  price_paisa: z.number().int().min(1000).max(10000000),
  published: z.boolean(), members: z.array(z.object({ bookId: z.uuid(), format: z.enum(["ebook", "physical"]) })).min(2).max(10)
    .refine((members) => new Set(members.map((m) => m.bookId)).size === members.length, "Choose each book once."),
}).superRefine((bundle, context) => {
  if (bundle.members.some((member) => member.format !== bundle.kind))
    context.addIssue({ code: "custom", path: ["members"], message: "Choose the matching edition for every book." });
});
