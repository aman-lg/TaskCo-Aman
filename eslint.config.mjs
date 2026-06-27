import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  globalIgnores([".next/**", "out/**", "build/**", "next-env.d.ts"]),
  {
    files: ["**/*.tsx", "**/*.ts"],
    rules: {
      // Block service-role client from ever reaching client-side code
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: ["*/lib/supabase/admin", "@/lib/supabase/admin"],
              message:
                "admin.ts is SERVER/EDGE ONLY. Never import it in 'use client' files.",
            },
          ],
        },
      ],
    },
  },
]);

export default eslintConfig;
