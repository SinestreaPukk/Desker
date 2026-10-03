/** Where someone lands when they go into their space: the settings of its one assistant. */
export function entryPath(project: { slug: string }): string {
  return `/p/${project.slug}/agent`;
}
