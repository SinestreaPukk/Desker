/** Where someone lands when they go into their space: the conversation with their assistant. */
export function entryPath(project: { slug: string }): string {
  return `/p/${project.slug}/chat`;
}
