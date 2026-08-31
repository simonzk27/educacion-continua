import { Construction } from 'lucide-react'

export default function ComingSoon({ title }: { title: string }) {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-4 rounded-2xl border border-dashed border-gray-300 py-24 text-center dark:border-gray-700">
      <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-600 dark:bg-indigo-500/10 dark:text-indigo-400">
        <Construction className="h-5 w-5" />
      </span>
      <div className="flex flex-col items-center gap-1">
        <h1 className="text-lg font-semibold text-gray-900 dark:text-gray-100">{title}</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400">
          Este módulo está en construcción.
        </p>
      </div>
    </div>
  )
}
