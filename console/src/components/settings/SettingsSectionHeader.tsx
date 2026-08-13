interface SettingsSectionHeaderProps {
  title: string
  description: string
}

export function SettingsSectionHeader({ title, description }: SettingsSectionHeaderProps) {
  return (
    <div className="mailstudio-card px-5 py-4 mb-4">
      <h1 className="text-2xl font-semibold text-slate-100 m-0 tracking-tight">{title}</h1>
      <p className="mt-1 mb-0 text-sm text-slate-400">{description}</p>
    </div>
  )
}
