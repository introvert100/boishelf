import path from "node:path";
export default { devIndicators: false as const, turbopack: { root: path.resolve(process.cwd()) } };
