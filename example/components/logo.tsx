import type { SVGProps } from "react";

/** A page with a folded corner whose lower half is drawn as pixels. */
export function Logo(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 20 20" fill="none" aria-hidden="true" {...props}>
      <path
        d="M4.5 1.75h7.25L15.5 5.5v4"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
      <path
        d="M4.5 1.75v7.75"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
      <path d="M11.75 1.75V5.5h3.75" stroke="currentColor" strokeWidth="1.5" />
      <rect x="3.75" y="11" width="3" height="3" fill="currentColor" />
      <rect x="8.5" y="11" width="3" height="3" fill="currentColor" />
      <rect x="13.25" y="11" width="3" height="3" fill="currentColor" />
      <rect x="3.75" y="15.5" width="3" height="3" fill="currentColor" />
      <rect
        x="8.5"
        y="15.5"
        width="3"
        height="3"
        fill="currentColor"
        opacity="0.5"
      />
    </svg>
  );
}
