export function PageHeader({
  title,
  subtitle,
  moduleColor,
}: {
  title: string
  subtitle?: string
  moduleColor?: string
}) {
  return (
    <header className="page-header">
      <div
        style={
          moduleColor
            ? { borderLeft: `3px solid ${moduleColor}`, paddingLeft: 10 }
            : undefined
        }
      >
        <h1>{title}</h1>
        {subtitle ? <p>{subtitle}</p> : null}
      </div>
    </header>
  )
}
