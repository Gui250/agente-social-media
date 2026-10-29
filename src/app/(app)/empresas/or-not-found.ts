import { notFound } from "next/navigation";
import { DomainError } from "@/lib/errors";

// Another owner's company or brand is a 404 page, same as one that doesn't exist.
export function orNotFound(err: unknown): never {
  if (err instanceof DomainError && err.status === 404) notFound();
  throw err;
}
