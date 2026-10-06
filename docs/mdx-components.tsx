import { Accordion, Accordions } from "fumadocs-ui/components/accordion";
import { File, Files, Folder } from "fumadocs-ui/components/files";
import { Step, Steps } from "fumadocs-ui/components/steps";
import { TypeTable } from "fumadocs-ui/components/type-table";
import defaultMdxComponents from "fumadocs-ui/mdx";
import type { MDXComponents } from "mdx/types";
import { BenchmarkChart } from "@/components/benchmark-chart";
import { Pipeline } from "@/components/pipeline";

export function getMDXComponents(components?: MDXComponents): MDXComponents {
  return {
    ...defaultMdxComponents,
    Accordion,
    BenchmarkChart,
    Pipeline,
    Accordions,
    Files,
    File,
    Folder,
    Steps,
    Step,
    TypeTable,
    ...components,
  };
}
