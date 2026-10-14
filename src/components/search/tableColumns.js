/**
 * Add a caller's `extraColumns` to a resource's base table columns. An extra
 * column with a base column's id replaces it where it stands, keeping the
 * base column's other fields, so a caller can change how one column renders
 * (OpenConceptLab/ocl_issues#2909: the Mapper names concepts in the project's
 * input language). The rest are appended. Pure.
 */
export const withExtraColumns = (columns, extraColumns) => {
  if(!extraColumns?.length) return columns
  const byId = new Map(extraColumns.map(column => [column.id, column]))
  return [
    ...columns.map(column => byId.has(column.id) ? {...column, ...byId.get(column.id)} : column),
    ...extraColumns.filter(column => !columns.some(base => base.id === column.id))
  ]
}
