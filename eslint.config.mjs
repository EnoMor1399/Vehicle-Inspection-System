import { defineConfig, globalIgnores } from "eslint/config";
import nextCoreWebVitals from "eslint-config-next/core-web-vitals";

export default defineConfig([
  // Keep the starter on the flat config export that actually runs under the pinned ESLint/Next toolchain.
  ...nextCoreWebVitals,
  // Certificate status is intentionally evaluated against request time. This route is
  // force-dynamic and server-rendered, so React's client-render purity warning for the
  // Date.now() expiry comparison is not applicable here.
  {
    files: ["src/app/certificate/**/page.tsx"],
    rules: {
      "react-hooks/purity": "off",
    },
  },
  globalIgnores([".next/**", "out/**", "build/**", "next-env.d.ts"]),
]);
