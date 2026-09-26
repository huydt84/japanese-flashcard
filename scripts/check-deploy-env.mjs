import { namesMarked, requireEnvironment, validateProductionEnvironment } from "./env-contract.mjs";

const required = [...await namesMarked("vercel"), ...await namesMarked("supabase-cli")];
requireEnvironment(required);
validateProductionEnvironment();

console.log(`Deployment environment is complete (${required.length} variables checked).`);
