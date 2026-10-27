import { test } from "node:test";
import assert from "node:assert/strict";
import { deliverySettingsInput, deliveryFee } from "../src/lib/delivery-validation";
import { checkoutControlsInput, closedCheckout } from "../src/lib/checkout-controls";

test("district fees allow free delivery and reject duplicate, invalid or missing values", () => {
  const districts = [{district: "Dhaka" as const,fee_paisa:5000},{district:"Gazipur" as const,fee_paisa:0}];
  assert.equal(deliverySettingsInput.safeParse({districts}).success,true);
  assert.equal(deliverySettingsInput.safeParse({districts:[]}).success,true);
  assert.equal(deliveryFee(districts,"Dhaka"),5000);
  assert.equal(deliveryFee(districts,"Gazipur"),0);
  assert.equal(deliveryFee(districts,"Sylhet"),null);
  for (const invalid of [[districts[0],districts[0]], [{district:"Fake",fee_paisa:50}],
    [{district:"Dhaka",fee_paisa:-1}], [{district:"Dhaka",fee_paisa:1000001}],
    [{district:"Dhaka",fee_paisa:1.5}], [{district:"Dhaka"}]])
    assert.equal(deliverySettingsInput.safeParse({districts:invalid}).success,false);
});

test("payment switches require explicit business and courier attestations", () => {
  assert.equal(checkoutControlsInput.safeParse(closedCheckout).success,true);
  assert.equal(checkoutControlsInput.safeParse({...closedCheckout,bkashEnabled:true}).success,false);
  assert.equal(checkoutControlsInput.safeParse({...closedCheckout,codEnabled:true}).success,false);
  assert.equal(checkoutControlsInput.safeParse({...closedCheckout,bkashEnabled:true,businessConfirmed:true}).success,true);
  assert.equal(checkoutControlsInput.safeParse({...closedCheckout,codEnabled:true,courierConfirmed:true}).success,true);
  assert.equal(checkoutControlsInput.safeParse({...closedCheckout,codEnabled:"true"}).success,false);
});
