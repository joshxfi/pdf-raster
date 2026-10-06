import type { BaseLayoutProps } from "fumadocs-ui/layouts/shared";
import { Logo } from "@/components/logo";

export const gitConfig = {
  user: "joshxfi",
  repo: "pdf-raster",
  branch: "main",
};

export const repoUrl = `https://github.com/${gitConfig.user}/${gitConfig.repo}`;
export const npmUrl = "https://www.npmjs.com/package/pdf-raster";

export function baseOptions(): BaseLayoutProps {
  return {
    nav: {
      title: (
        <span className="inline-flex items-center gap-2 font-semibold tracking-tight">
          <Logo className="size-5 text-fd-primary" />
          pdf-raster
        </span>
      ),
    },
    githubUrl: repoUrl,
    links: [
      { text: "Docs", url: "/docs", active: "nested-url", on: "nav" },
      { text: "Benchmark", url: "/docs/benchmark", on: "nav" },
      { text: "npm", url: npmUrl, external: true },
    ],
  };
}
