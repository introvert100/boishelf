import fs from "node:fs";
import YAML from "yaml";
import Ajv from "ajv/dist/2020.js";
import addFormats from "ajv-formats";
const response = await fetch("https://render.com/schema/render.yaml.json");
if (!response.ok) throw new Error("Cannot fetch official Render schema");
const schema = await response.json();
const ajv = new Ajv({ strict: false, allErrors: true });
addFormats(ajv);
const validate = ajv.compile(schema);
if (!validate(YAML.parse(fs.readFileSync("render.yaml", "utf8")))) {
  console.error(validate.errors);
  process.exitCode = 1;
} else
  console.log("render.yaml passes the current official Render JSON schema.");
