import { ReactNode } from 'react'

interface Column<T> {
  key: keyof T | string
  header: string
  render?: (row: T) => ReactNode
}

interface Props<T> {
  data: T[]
  columns: Column<T>[]
}

export function Table<T extends Record<string, unknown>>({ data, columns }: Props<T>) {
  return (
    <table className="table">
      <thead>
        <tr>
          {columns.map((column) => (
            <th key={String(column.key)}>{column.header}</th>
          ))}
        </tr>
      </thead>
      <tbody>
        {data.map((row, index) => (
          <tr key={index}>
            {columns.map((column) => (
              <td key={String(column.key)}>{column.render ? column.render(row) : String(row[column.key as keyof T] ?? '')}</td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  )
}
