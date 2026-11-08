import { loadDeploymentEnvironment, namesMarked, requireEnvironment, validateProductionEnvironment } from "./env-contract.mjs";

await loadDeploymentEnvironment();
const required = [...await namesMarked("vercel"), ...await namesMarked("neon-cli")];
requireEnvironment(required);
validateProductionEnvironment();

console.log(`Deployment environment is complete (${required.length} variables checked).`);
